import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Client, MessageEvent, FollowEvent, TextMessage } from '@line/bot-sdk';
import { LineConfigService } from './line-config.service';
import { HubspotService } from '../../hubspot/services/hubspot.service';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class LineService {
  private readonly client: Client;
  private readonly logger = new Logger(LineService.name);

  constructor(
    private lineConfigService: LineConfigService,
    private hubspotService: HubspotService,
    private tenantPrisma: TenantPrismaService,
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
    let contactId: string|null;

    if (existingContact) {
      await this.hubspotService.updateContact(tenantId, existingContact.id, hubspotContactProps);
      contactId = existingContact.id;
    } else {
      const newContact = await this.hubspotService.createContact(tenantId, hubspotContactProps);
      contactId = newContact.id;
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
    const messageText = event.message.text;
    this.logger.log(`租户 ${tenantId} - 收到 Line 消息 [${lineUserId}]: ${messageText}`);

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // 1. 查询该租户下的对话通道
      const channel = await tx.channel.findUnique({
        where: {
          tenantId_channelType_externalUserId: {
            tenantId,
            channelType: 'LINE',
            externalUserId: lineUserId,
          },
        },
      });
      if (!channel) {
        return this.client.replyMessage(event.replyToken, {
          type: 'text',
          text: '请先关注公众号（添加好友）后再发送消息~',
        });
      }

      // 2. 存储消息
      await tx.message.create({
        data: {
          channelId: channel.id,
          tenantId,
          content: messageText,
          isFromUser: true,
        },
      });

      // 3. 转发消息到 HubSpot 对话
      await this.hubspotService.createConversation(tenantId, {
        contactId: channel.hubspotContactId,
        message: messageText,
        senderType: 'CONTACT',
      });

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
      return tx.channel.upsert({
        where: {
          tenantId_channelType_externalUserId: {
            tenantId,
            channelType: 'LINE',
            externalUserId: lineUserId,
          },
        },
        update: {
          hubspotContactId,
        },
        create: {
          tenantId,
          channelType: 'LINE',
          externalUserId: lineUserId,
          hubspotContactId,
        },
      });
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
      const channel = await tx.channel.findUnique({
        where: { id: channelId },
      });
      if (!channel) {
        throw new NotFoundException(`租户 ${tenantId} 对话通道不存在：${channelId}`);
      }

      await this.sendMessage(tenantId, channel.externalUserId, messageText);

      await tx.message.create({
        data: {
          tenantId,
          channelId: channel.id,
          content: messageText,
          isFromUser: false,
        },
      });

      await this.hubspotService.createConversation(tenantId, {
        contactId: channel.hubspotContactId,
        message: messageText,
        senderType: 'USER',
      });

      return { success: true };
    });
  }

  /**
   * 获取对话历史消息
   */
  async getMessageHistory(tenantId: string, channelId: number) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      return tx.message.findMany({
        where: { tenantId, channelId },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  /**
   * 根据租户 ID 和 HubSpot 联系人 ID 查询 Line 通道
   */
  async getChannelByTenantAndContactId(tenantId: string, contactId: string) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      return tx.channel.findFirst({
        where: { tenantId, hubspotContactId: contactId, channelType: 'LINE' },
      });
    });
  }
}