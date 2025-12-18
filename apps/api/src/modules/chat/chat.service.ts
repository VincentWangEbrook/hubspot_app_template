/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { TenantPrismaService, TenantChannel, TenantMessage } from '../prisma/tenant-prisma.service';
import { ChannelAdapterFactory } from '../channel/channel-adapter.factory';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';
import { HubspotService } from '../hubspot/services/hubspot.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { InitConversationDto } from './dto/init-conversation.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly channelAdapterFactory: ChannelAdapterFactory,
    private readonly multiChannelService: MultiChannelService,
    private readonly hubspotService: HubspotService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * 发送消息（中台 -> 用户终端 + HubSpot）
   */
  async sendMessage(dto: SendMessageDto) {
    const { tenantId, channelId, content, userId, messageType = 'text', metadata } = dto;

    // 🐛 修复: 验证 channelId 是安全整数
    if (!Number.isSafeInteger(channelId) || channelId <= 0) {
      throw new Error(`Invalid channelId: ${channelId}`);
    }

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // 1. 获取 Channel
      const channels = await tx.$queryRaw<TenantChannel[]>`
        SELECT 
          id, 
          tenant_id as "tenantId", 
          channel_type as "channelType",
          external_user_id as "externalUserId",
          hubspot_contact_id as "hubspotContactId",
          contact_name as "contactName",
          contact_avatar as "contactAvatar",
          unread_count as "unreadCount",
          last_message_at as "lastMessageAt",
          status,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM channels
        WHERE id = ${channelId}
        LIMIT 1
      `;

      const channel = channels[0];

      if (!channel) {
        throw new NotFoundException(`Channel ${channelId} not found`);
      }

      // 2. 获取渠道适配器并发送消息
      // 验证 channelType 是否有效
      if (!channel.channelType) {
        throw new Error(`Invalid channel type for channel ${channelId}`);
      }

      let adapter;
      try {
        adapter = this.channelAdapterFactory.getAdapter(channel.channelType as any);
      } catch (error: any) {
        throw new Error(`Unsupported channel type: ${channel.channelType}`);
      }

      if (!adapter) {
        throw new Error(`No adapter found for channel type: ${channel.channelType}`);
      }

      const sendResult = await adapter.sendMessage({
        tenantId,
        externalUserId: channel.externalUserId,
        content,
        messageType: messageType as 'text' | 'image' | 'file',
        metadata,
      });

      // 3. 保存消息到数据库
      const messageStatus = sendResult.success ? 'sent' : 'failed';
      const messageMetadata = sendResult.success
        ? metadata
        : { ...metadata, error: sendResult.error };

      const messages = await tx.$queryRaw<TenantMessage[]>`
        INSERT INTO messages (
          channel_id, tenant_id, content, is_from_user, message_type, 
          sender_id, external_id, status, metadata, created_at
        )
        VALUES (
          ${channelId}, ${tenantId}::uuid, ${content}, false, ${messageType},
          ${userId}::uuid, ${sendResult.externalMessageId || null}, ${messageStatus}, 
          ${messageMetadata ? JSON.stringify(messageMetadata) : null}::jsonb, NOW()
        )
        RETURNING 
          id,
          channel_id as "channelId",
          tenant_id as "tenantId",
          content,
          is_from_user as "isFromUser",
          message_type as "messageType",
          sender_id as "senderId",
          external_id as "externalId",
          status,
          metadata,
          read_at as "readAt",
          created_at as "createdAt"
      `;

      const message = messages[0];

      // 4. 更新 Channel 的最后消息时间
      const updateStatus = sendResult.error?.includes('blocked') ? 'blocked' : channel.status;
      await tx.$executeRaw`
        UPDATE channels
        SET last_message_at = NOW(), status = ${updateStatus}, updated_at = NOW()
        WHERE id = ${channelId}
      `;

      // 5. 同步到 HubSpot（异步处理失败）
      try {
        await this.multiChannelService.sendMessageToHubspot(
          tenantId,
          channel,
          content,
          'USER',
        );
      } catch (error: any) {
        this.logger.error(`Failed to sync to HubSpot: ${error.message}`);
        // 消息已发送到 LINE，HubSpot 同步失败不影响主流程
        // 可以加入重试队列
      }

      // 6. 通过 WebSocket 广播消息
      this.chatGateway.emitMessageToRoom(tenantId, {
        event: 'message.created',
        data: message,
      });
      this.chatGateway.emitMessageToRoom(`channel_${channelId}`, {
        event: 'message.created',
        data: message,
      });

      return message;
    });
  }

  /**
   * 获取对话列表（收件箱）
   */
  async getConversations(dto: GetConversationsDto) {
    const { tenantId, channelType, search, page = 1, limit = 20 } = dto;

    // 验证 tenantId 不为空
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('Invalid tenantId: cannot be empty');
    }

    // 验证分页参数，防止数值溢出
    const safePage = Math.max(1, Math.min(page, 10000)); // 限制最大页码
    const safeLimit = Math.max(1, Math.min(limit, 100)); // 限制最大每页数量
    
    // 检查 skip 计算是否溢出
    const skip = (safePage - 1) * safeLimit;
    if (skip > Number.MAX_SAFE_INTEGER || skip < 0) {
      throw new Error('Pagination overflow: page number too large');
    }

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // Build WHERE clause dynamically
      let whereConditions = `tenant_id = '${tenantId}'::uuid AND status = 'active'`;
      
      if (channelType) {
        whereConditions += ` AND channel_type = '${channelType}'`;
      }

      if (search) {
        // Escape single quotes in search
        const escapedSearch = search.replace(/'/g, "''");
        whereConditions += ` AND contact_name ILIKE '%${escapedSearch}%'`;
      }

      // Get channels with last message using subquery
      const channels = await tx.$queryRawUnsafe<(TenantChannel & { 
        lastMessageContent: string | null;
        lastMessageCreatedAt: Date | null;
        lastMessageIsFromUser: boolean | null;
      })[]>(`
        SELECT 
          c.id,
          c.tenant_id as "tenantId",
          c.channel_type as "channelType",
          c.external_user_id as "externalUserId",
          c.hubspot_contact_id as "hubspotContactId",
          c.contact_name as "contactName",
          c.contact_avatar as "contactAvatar",
          c.unread_count as "unreadCount",
          c.last_message_at as "lastMessageAt",
          c.status,
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          m.content as "lastMessageContent",
          m.created_at as "lastMessageCreatedAt",
          m.is_from_user as "lastMessageIsFromUser"
        FROM channels c
        LEFT JOIN LATERAL (
          SELECT content, created_at, is_from_user
          FROM messages
          WHERE channel_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON true
        WHERE ${whereConditions}
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT ${safeLimit} OFFSET ${skip}
      `);

      // Get total count
      const countResult = await tx.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) as count
        FROM channels
        WHERE ${whereConditions}
      `);

      const total = Number(countResult[0]?.count || 0);

      const data = channels.map((channel) => {
        const lastMessage = channel.lastMessageContent
          ? {
              content: channel.lastMessageContent || '',
              createdAt: channel.lastMessageCreatedAt?.toISOString() || new Date().toISOString(),
              isFromUser: channel.lastMessageIsFromUser || false,
            }
          : undefined;

        return {
          channelId: channel.id,
          channelType: channel.channelType,
          externalUserId: channel.externalUserId,
          hubspotContactId: channel.hubspotContactId,
          contactName: channel.contactName || 'Unknown',
          contactAvatar: channel.contactAvatar || null,
          lastMessage,
          unreadCount: channel.unreadCount || 0,
          updatedAt: channel.updatedAt?.toISOString() || new Date().toISOString(),
        };
      });

      return {
        data,
        meta: {
          total,
          page: safePage,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit),
        },
      };
    });
  }

  /**
   * 获取消息历史
   */
  async getMessages(channelId: number, dto: GetMessagesDto) {
    const { tenantId, page = 1, limit = 50 } = dto;

    // 🐛 修复: 验证 tenantId 不为空
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('Invalid tenantId: cannot be empty');
    }

    // 🐛 修复: 验证 channelId 是否在安全整数范围内
    if (!Number.isSafeInteger(channelId) || channelId <= 0) {
      throw new Error(`Invalid channelId: ${channelId}`);
    }

    // 🐛 修复: 验证分页参数，防止数值溢出
    const safePage = Math.max(1, Math.min(page, 10000));
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * safeLimit;
    
    if (skip > Number.MAX_SAFE_INTEGER || skip < 0) {
      throw new Error('Pagination overflow');
    }

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const [messages, countResult] = await Promise.all([
        tx.$queryRaw<TenantMessage[]>`
          SELECT 
            id,
            channel_id as "channelId",
            tenant_id as "tenantId",
            content,
            is_from_user as "isFromUser",
            message_type as "messageType",
            sender_id as "senderId",
            external_id as "externalId",
            status,
            metadata,
            read_at as "readAt",
            created_at as "createdAt"
          FROM messages
          WHERE channel_id = ${channelId} AND tenant_id = ${tenantId}::uuid
          ORDER BY created_at ASC
          LIMIT ${safeLimit} OFFSET ${skip}
        `,
        tx.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM messages
          WHERE channel_id = ${channelId} AND tenant_id = ${tenantId}::uuid
        `,
      ]);

      const total = Number(countResult[0]?.count || 0);

      return {
        data: messages,
        meta: {
          total,
          page: safePage,
          limit: safeLimit,
        },
      };
    });
  }

  /**
   * 从 Contact 初始化对话
   */
  async getOrCreateConversation(dto: InitConversationDto) {
    const { tenantId, hubspotContactId, channelType } = dto;

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // 查找现有对话
      const existingChannels = await tx.$queryRaw<TenantChannel[]>`
        SELECT 
          id,
          tenant_id as "tenantId",
          channel_type as "channelType",
          external_user_id as "externalUserId",
          hubspot_contact_id as "hubspotContactId",
          contact_name as "contactName",
          contact_avatar as "contactAvatar",
          unread_count as "unreadCount",
          last_message_at as "lastMessageAt",
          status,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM channels
        WHERE tenant_id = ${tenantId}::uuid 
          AND hubspot_contact_id = ${hubspotContactId}
          AND channel_type = ${channelType}
        LIMIT 1
      `;

      const existingChannel = existingChannels[0];

      if (existingChannel) {
        return {
          channelId: existingChannel.id,
          channelType: existingChannel.channelType,
          contactName: existingChannel.contactName,
          externalUserId: existingChannel.externalUserId,
        };
      }

      // 从数据库获取 HubSpot Contact 信息
      const contact = await this.hubspotService.getContactByIdFromDb(tenantId, hubspotContactId);
      
      if (!contact) {
        throw new NotFoundException(`Contact ${hubspotContactId} not found`);
      }

      // 检查 Contact 是否绑定了对应渠道的用户 ID
      const properties = contact.properties as Record<string, any> || {};
      let externalUserId: string | null = null;

      // 根据渠道类型获取对应的外部用户 ID
      if (channelType === 'LINE') {
        externalUserId = properties.jika_line_user_id || null;
      } else if (channelType === 'WECHAT') {
        externalUserId = properties.jika_wechat_user_id || null;
      }

      if (!externalUserId) {
        throw new BadRequestException(
          `Contact ${hubspotContactId} has not bound ${channelType} account`
        );
      }

      // 获取用户资料并创建新的 Channel
      const adapter = this.channelAdapterFactory.getAdapter(channelType as any);
      let profile: { displayName: string | null; pictureUrl: string | null } = { 
        displayName: null, 
        pictureUrl: null 
      };
      
      try {
        const userProfile = await adapter.getUserProfile(externalUserId, tenantId);
        profile.displayName = userProfile.displayName || null;
        profile.pictureUrl = userProfile.pictureUrl || null;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Failed to get user profile for ${externalUserId}: ${errorMessage}`);
        // 使用 HubSpot Contact 的信息作为后备
        profile.displayName = [contact.firstname, contact.lastname].filter(Boolean).join(' ') || null;
      }

      // 创建新的 Channel
      const newChannels = await tx.$queryRaw<TenantChannel[]>`
        INSERT INTO channels (
          tenant_id, channel_type, external_user_id, hubspot_contact_id,
          contact_name, contact_avatar, status, unread_count, created_at, updated_at
        )
        VALUES (
          ${tenantId}::uuid, ${channelType}, ${externalUserId}, ${hubspotContactId},
          ${profile.displayName || null}, ${profile.pictureUrl || null}, 'active', 0, NOW(), NOW()
        )
        RETURNING 
          id,
          tenant_id as "tenantId",
          channel_type as "channelType",
          external_user_id as "externalUserId",
          hubspot_contact_id as "hubspotContactId",
          contact_name as "contactName",
          contact_avatar as "contactAvatar",
          unread_count as "unreadCount",
          last_message_at as "lastMessageAt",
          status,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const newChannel = newChannels[0];

      this.logger.log(
        `Created new ${channelType} channel for contact ${hubspotContactId}, externalUserId: ${externalUserId}`
      );

      return {
        channelId: newChannel.id,
        channelType: newChannel.channelType,
        contactName: newChannel.contactName,
        externalUserId: newChannel.externalUserId,
      };
    });
  }

  /**
   * 处理接收到的消息
   */
  async handleIncomingMessage(params: {
    tenantId: string;
    channelType: string;
    externalUserId: string;
    content: string;
    externalMessageId?: string;
    hubspotContactId?: string;
  }) {
    const { tenantId, channelType, externalUserId, content, externalMessageId, hubspotContactId } = params;

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // 1. 查找或创建 Channel
      const existingChannels = await tx.$queryRaw<TenantChannel[]>`
        SELECT 
          id,
          tenant_id as "tenantId",
          channel_type as "channelType",
          external_user_id as "externalUserId",
          hubspot_contact_id as "hubspotContactId",
          contact_name as "contactName",
          contact_avatar as "contactAvatar",
          unread_count as "unreadCount",
          last_message_at as "lastMessageAt",
          status,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM channels
        WHERE tenant_id = ${tenantId}::uuid 
          AND channel_type = ${channelType}
          AND external_user_id = ${externalUserId}
        LIMIT 1
      `;

      let channel = existingChannels[0];

      if (!channel && hubspotContactId) {
        // 自动创建 Channel
        const adapter = this.channelAdapterFactory.getAdapter(channelType as any);
        const profile = await adapter.getUserProfile(externalUserId, tenantId);

        const newChannels = await tx.$queryRaw<TenantChannel[]>`
          INSERT INTO channels (
            tenant_id, channel_type, external_user_id, hubspot_contact_id,
            contact_name, contact_avatar, status, unread_count, created_at, updated_at
          )
          VALUES (
            ${tenantId}::uuid, ${channelType}, ${externalUserId}, ${hubspotContactId},
            ${profile.displayName || null}, ${profile.pictureUrl || null}, 'active', 0, NOW(), NOW()
          )
          RETURNING 
            id,
            tenant_id as "tenantId",
            channel_type as "channelType",
            external_user_id as "externalUserId",
            hubspot_contact_id as "hubspotContactId",
            contact_name as "contactName",
            contact_avatar as "contactAvatar",
            unread_count as "unreadCount",
            last_message_at as "lastMessageAt",
            status,
            created_at as "createdAt",
            updated_at as "updatedAt"
        `;

        channel = newChannels[0];
      }

      if (!channel) {
        throw new NotFoundException('Channel not found');
      }

      // 2. 检查是否是重复消息
      if (externalMessageId) {
        const existing = await tx.$queryRaw<TenantMessage[]>`
          SELECT id FROM messages
          WHERE external_id = ${externalMessageId} AND tenant_id = ${tenantId}::uuid
          LIMIT 1
        `;

        if (existing.length > 0) {
          return existing[0];
        }
      }

      // 🐛 修复: 清理 content 中的特殊字符（NULL 字符等）
      const sanitizedContent = content.replace(/\0/g, ''); // 移除 NULL 字符

      // 3. 保存消息（使用 try-catch 捕获唯一约束冲突）
      let message: TenantMessage;
      try {
        const messages = await tx.$queryRaw<TenantMessage[]>`
          INSERT INTO messages (
            channel_id, tenant_id, content, is_from_user, external_id, status, created_at
          )
          VALUES (
            ${channel.id}, ${tenantId}::uuid, ${sanitizedContent}, true, 
            ${externalMessageId || null}, 'received', NOW()
          )
          RETURNING 
            id,
            channel_id as "channelId",
            tenant_id as "tenantId",
            content,
            is_from_user as "isFromUser",
            message_type as "messageType",
            sender_id as "senderId",
            external_id as "externalId",
            status,
            metadata,
            read_at as "readAt",
            created_at as "createdAt"
        `;
        message = messages[0];
      } catch (error: any) {
        // 如果是唯一约束冲突（并发插入），重新查找
        if (error.code === 'P2002' && externalMessageId) {
          const existing = await tx.$queryRaw<TenantMessage[]>`
            SELECT 
              id,
              channel_id as "channelId",
              tenant_id as "tenantId",
              content,
              is_from_user as "isFromUser",
              message_type as "messageType",
              sender_id as "senderId",
              external_id as "externalId",
              status,
              metadata,
              read_at as "readAt",
              created_at as "createdAt"
            FROM messages
            WHERE external_id = ${externalMessageId} AND tenant_id = ${tenantId}::uuid
            LIMIT 1
          `;
          if (existing.length > 0) return existing[0];
        }
        throw error;
      }

      // 4. 更新 Channel
      await tx.$executeRaw`
        UPDATE channels
        SET unread_count = unread_count + 1, last_message_at = NOW(), updated_at = NOW()
        WHERE id = ${channel.id}
      `;

      // 5. 同步到 HubSpot
      try {
        await this.multiChannelService.sendMessageToHubspot(
          tenantId,
          channel,
          content,
          'CONTACT',
        );
      } catch (error: any) {
        this.logger.error(`Failed to sync to HubSpot: ${error.message}`);
      }

      // 6. 通过 WebSocket 广播
      this.chatGateway.emitMessageToRoom(tenantId, {
        event: 'message.created',
        data: message,
      });
      this.chatGateway.emitMessageToRoom(`channel_${channel.id}`, {
        event: 'message.created',
        data: message,
      });

      return message;
    });
  }

  /**
   * 标记消息为已读
   */
  async markAsRead(channelId: number, tenantId: string) {
    // 验证 channelId 和 tenantId
    if (!Number.isSafeInteger(channelId) || channelId <= 0) {
      throw new Error(`Invalid channelId: ${channelId}`);
    }
    
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('Invalid tenantId: cannot be empty');
    }

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      await tx.$executeRaw`
        UPDATE channels
        SET unread_count = 0, updated_at = NOW()
        WHERE id = ${channelId}
      `;
    });
  }

  /**
   * 处理渠道事件（如 Follow）
   */
  async handleChannelEvent(params: {
    tenantId: string;
    channelType: string;
    eventType: string;
    externalUserId: string;
    userData: any;
  }) {
    this.logger.log(
      `Handling ${params.eventType} event for ${params.externalUserId}`,
    );
    // TODO: 实现 Follow 事件处理逻辑
    // 例如：创建 HubSpot Contact，创建 Channel 等
    return {};
  }
}
