/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Client, MessageEvent, FollowEvent, TextMessage } from '@line/bot-sdk';
import { LineConfigService } from './line-config.service';
import { HubspotService } from '../../hubspot/services/hubspot.service';
import { TenantPrismaService, TenantChannel, TenantMessage } from '../../prisma/tenant-prisma.service';
import { ChatGateway } from '../../chat/chat.gateway';
import { MultiChannelService } from '../../hubspot/services/multi-channel.service';
import { SchemaManagerService } from '../../tenants/services/schema-manager.service';

@Injectable()
export class LineService {
  private readonly client: Client;
  private readonly logger = new Logger(LineService.name);

  constructor(
    private lineConfigService: LineConfigService,
    private hubspotService: HubspotService,
    private tenantPrisma: TenantPrismaService,
    private chatGateway: ChatGateway,
    private multiChannelService: MultiChannelService,
    private schemaManager: SchemaManagerService,
  ) {
    this.client = new Client(this.lineConfigService.getClientConfig());
  }

  /**
   * 处理 Line Webhook 事件
   */
  async handleWebhookEvents(events: (MessageEvent | FollowEvent)[], tenantId: string) {
    const results = await Promise.all(
      events.map(async (event) => {
        try {
          if (event.type === 'follow') {
            return this.handleFollowEvent(event, tenantId);
          }
          if (event.type === 'message' && (event.message as TextMessage).type === 'text') {
            return this.handleMessageEvent(event as MessageEvent, tenantId);
          }
          return null;
        } catch (err: any) {
          this.logger.error(`租户 ${tenantId} 处理 Line 事件失败: ${err.message}`, err.stack);
          return null;
        }
      }),
    );
    return results.filter(Boolean);
  }

  /**
   * 处理添加好友事件
   */
  private async handleFollowEvent(event: FollowEvent, tenantId: string) {
    const lineUserId = event.source.userId!;
    this.logger.log(`租户 ${tenantId} - Line 用户添加好友: ${lineUserId}`);

    // 1. 获取 Line 用户信息
    const lineUser = await this.client.getProfile(lineUserId);

    // 2. 同步到 HubSpot Contact
    const hubspotContactProps = {
      email: `${lineUserId}@line.com`,
      firstname: lineUser.displayName || 'Line User',
      line_user_id: lineUserId,
      line_display_name: lineUser.displayName,
      line_picture_url: lineUser.pictureUrl || '',
    };

    const existingContact = await this.hubspotService.findContactByProperty(
      tenantId,
      'line_user_id',
      lineUserId,
    );
    let contactId: string | null;

    if (existingContact) {
      await this.hubspotService.updateContact(tenantId, existingContact.id, hubspotContactProps);
      contactId = existingContact.id;
    } else {
      const newContact = await this.hubspotService.createContact(tenantId, hubspotContactProps);
      contactId = newContact.id;
    }

    if (!contactId) {
      throw new Error(`Failed to create or find HubSpot contact for Line user ${lineUserId}`);
    }

    // 3. 创建对话通道
    await this.createOrUpdateChannel(tenantId, lineUserId, contactId);

    // 4. 回复欢迎消息
    return this.client.replyMessage(event.replyToken, {
      type: 'text',
      text: `欢迎关注！您已成功绑定租户 ${tenantId} 的 HubSpot 服务，可直接发送咨询问题~`,
    });
  }

  /**
   * 处理文本消息事件
   */
  private async handleMessageEvent(event: MessageEvent, tenantId: string) {
    const lineUserId = event.source.userId!;
    // Type guard: only text messages have the text property
    if (event.message.type !== 'text') {
      this.logger.log(`Tenant ${tenantId} - Received non-text message from ${lineUserId}, skipping`);
      return;
    }
    const messageText = event.message.text;
    this.logger.log(`租户 ${tenantId} - 收到 Line 消息 [${lineUserId}]: ${messageText}`);

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // 1. 查询该租户下的对话通道
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
        WHERE tenant_id = ${tenantId}::uuid 
          AND channel_type = 'LINE' 
          AND external_user_id = ${lineUserId}
        LIMIT 1
      `;

      const channel = channels[0];

      if (!channel) {
        return this.client.replyMessage(event.replyToken, {
          type: 'text',
          text: '请先关注公众号（添加好友）后再发送消息~',
        });
      }

      // 2. 存储消息
      const messages = await tx.$queryRaw<TenantMessage[]>`
        INSERT INTO messages (channel_id, tenant_id, content, is_from_user, created_at)
        VALUES (${channel.id}, ${tenantId}::uuid, ${messageText}, true, NOW())
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

      // Emit WebSocket event
      this.chatGateway.emitMessageToRoom(tenantId, {
        event: 'message.created',
        data: message,
      });
      this.chatGateway.emitMessageToRoom(`channel_${channel.id}`, {
        event: 'message.created',
        data: message,
      });

      // 3. 转发消息到 HubSpot 对话
      await this.multiChannelService.sendMessageToHubspot(tenantId, channel, messageText, 'CONTACT');

      // 4. 回复已读确认
      return this.client.replyMessage(event.replyToken, {
        type: 'text',
        text: `消息已收到，我们会尽快回复您~`,
      });
    });
  }

  /**
   * 创建/更新对话通道
   */
  async createOrUpdateChannel(tenantId: string, lineUserId: string, hubspotContactId: string) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // Check if channel exists
      const existing = await tx.$queryRaw<TenantChannel[]>`
        SELECT id FROM channels
        WHERE tenant_id = ${tenantId}::uuid 
          AND channel_type = 'LINE' 
          AND external_user_id = ${lineUserId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        // Update existing channel
        await tx.$executeRaw`
          UPDATE channels
          SET hubspot_contact_id = ${hubspotContactId}, updated_at = NOW()
          WHERE tenant_id = ${tenantId}::uuid 
            AND channel_type = 'LINE' 
            AND external_user_id = ${lineUserId}
        `;

        const updated = await tx.$queryRaw<TenantChannel[]>`
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
            AND channel_type = 'LINE' 
            AND external_user_id = ${lineUserId}
          LIMIT 1
        `;
        return updated[0];
      } else {
        // Create new channel
        const created = await tx.$queryRaw<TenantChannel[]>`
          INSERT INTO channels (
            tenant_id, channel_type, external_user_id, hubspot_contact_id, 
            unread_count, status, created_at, updated_at
          )
          VALUES (
            ${tenantId}::uuid, 'LINE', ${lineUserId}, ${hubspotContactId},
            0, 'active', NOW(), NOW()
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
        return created[0];
      }
    });
  }

  /**
   * 发送消息给 Line 用户 (Outbound)
   */
  async sendMessage(tenantId: string, lineUserId: string, text: string) {
    // 1. 发送消息到 Line API
    await this.client.pushMessage(lineUserId, {
      type: 'text',
      text: text,
    });
    this.logger.log(`租户 ${tenantId} - 发送 Line 消息给 [${lineUserId}]: ${text}`);
  }

  /**
   * 从 HubSpot 回复 Line 用户消息 (Legacy method, kept for compatibility if needed)
   */
  async replyToLine(tenantId: string, channelId: number, messageText: string) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
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
        throw new NotFoundException(`租户 ${tenantId} 对话通道不存在：${channelId}`);
      }

      await this.sendMessage(tenantId, channel.externalUserId, messageText);

      await tx.$executeRaw`
        INSERT INTO messages (tenant_id, channel_id, content, is_from_user, created_at)
        VALUES (${tenantId}::uuid, ${channel.id}, ${messageText}, false, NOW())
      `;

      await this.multiChannelService.sendMessageToHubspot(tenantId, channel, messageText, 'USER');

      return { success: true };
    });
  }

  /**
   * 获取对话历史消息
   */
  async getMessageHistory(tenantId: string, channelId: number) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      return tx.$queryRaw<TenantMessage[]>`
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
        WHERE tenant_id = ${tenantId}::uuid AND channel_id = ${channelId}
        ORDER BY created_at ASC
      `;
    });
  }

  /**
   * 根据租户 ID 和 HubSpot 联系人 ID 查询 Line 通道
   */
  async getChannelByTenantAndContactId(tenantId: string, contactId: string) {
    //await this.schemaManager.ensureSchemaUpToDate(tenantId);
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
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
        WHERE tenant_id = ${tenantId}::uuid 
          AND hubspot_contact_id = ${contactId} 
          AND channel_type = 'LINE'
        LIMIT 1
      `;
      return channels[0] || null;
    });
  }
}
