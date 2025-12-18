/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, Logger } from '@nestjs/common';
import { messagingApi } from '@line/bot-sdk';
import {
  IChannelAdapter,
  SendMessageParams,
  SendMessageResult,
  WebhookResult,
  IncomingMessage,
  ChannelEvent,
  ExternalUserProfile,
} from '../interfaces/channel-adapter.interface';
import { ChannelConfigService } from '../channel-config.service';

const { MessagingApiClient } = messagingApi;

@Injectable()
export class LineChannelAdapter implements IChannelAdapter {
  readonly channelType = 'LINE' as const;
  private readonly logger = new Logger(LineChannelAdapter.name);
  private readonly MAX_CONTENT_LENGTH = 5000;
  private readonly MAX_RETRIES = 3;

  constructor(private readonly channelConfigService: ChannelConfigService) {}

  /**
   * 获取 LINE Messaging API 客户端
   */
  private async getLineClient(tenantId: string): Promise<messagingApi.MessagingApiClient> {
    const config = await this.channelConfigService.getConfig(tenantId, 'LINE');
    
    if (!config.channelAccessToken) {
      throw new Error('LINE channel access token not configured');
    }

    return new MessagingApiClient({
      channelAccessToken: config.channelAccessToken,
    });
  }

  /**
   * 发送消息到 LINE
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const { tenantId, externalUserId, content, messageType = 'text' } = params;

    try {
      const client = await this.getLineClient(tenantId);
      
      // 重试逻辑
      let lastError: any = null;
      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          const response = await client.pushMessage({
            to: externalUserId,
            messages: [
              {
                type: messageType as 'text',
                text: content,
              },
            ],
          });

          return {
            success: true,
            externalMessageId: response.sentMessages?.[0]?.id,
          };
        } catch (error: any) {
          lastError = error;
          
          // 检查是否是限流 (429)
          if (error.statusCode === 429) {
            return {
              success: false,
              error: 'Rate limit exceeded',
            };
          }

          // 检查是否是用户封锁 (403)
          if (
            error.statusCode === 403 &&
            error.message?.includes('blocked')
          ) {
            return {
              success: false,
              error: 'User blocked bot',
            };
          }

          // 检查是否是网络超时
          if (error.code === 'ETIMEDOUT' && attempt < this.MAX_RETRIES) {
            this.logger.warn(`Retry ${attempt}/${this.MAX_RETRIES} for ${externalUserId}`);
            await this.delay(1000 * attempt); // 指数退避
            continue;
          }

          // 如果是最后一次重试，返回错误
          if (attempt === this.MAX_RETRIES && error.code === 'ETIMEDOUT') {
            return {
              success: false,
              error: 'Network timeout after retries',
            };
          }

          throw error;
        }
      }

      return {
        success: false,
        error: lastError?.message || 'Unknown error',
      };
    } catch (error: any) {
      this.logger.error(`Failed to send LINE message: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 处理 LINE Webhook 事件
   */
  async handleWebhook(payload: any, tenantId: string): Promise<WebhookResult> {
    const messages: IncomingMessage[] = [];
    const events: ChannelEvent[] = [];
    const processedIds = new Set<string>();

    try {
      const webhookEvents = payload.events || [];

      for (const event of webhookEvents) {
        const externalUserId = event.source?.userId;
        if (!externalUserId) continue;

        // 处理 Follow 事件
        if (event.type === 'follow') {
          events.push({
            type: 'follow',
            externalUserId,
            timestamp: new Date(event.timestamp),
            data: event,
          });
          continue;
        }

        // 处理消息事件
        if (event.type === 'message' && event.message?.type === 'text') {
          const messageId = event.message.id;

          // 去重
          if (processedIds.has(messageId)) {
            continue;
          }
          processedIds.add(messageId);

          let content = event.message.text;
          const metadata: any = {};

          // 🐛 修复: 安全截断消息，防止在 Unicode 字符（如 Emoji）中间截断
          if (content.length > this.MAX_CONTENT_LENGTH) {
            metadata.truncated = true;
            metadata.originalLength = content.length;
            
            // 使用 Array.from 正确处理 Unicode 字符
            const chars = Array.from(content);
            if (chars.length > this.MAX_CONTENT_LENGTH) {
              content = chars.slice(0, this.MAX_CONTENT_LENGTH).join('');
            }
          }

          messages.push({
            externalUserId,
            content,
            messageType: 'text',
            timestamp: new Date(event.timestamp),
            rawPayload: event,
            ...(Object.keys(metadata).length > 0 && { metadata }),
          });
        }
      }

      return { messages, events };
    } catch (error: any) {
      this.logger.error(`Failed to handle LINE webhook: ${error.message}`);
      return { messages: [], events: [] };
    }
  }

  /**
   * 获取 LINE 用户资料
   */
  async getUserProfile(externalUserId: string, tenantId: string): Promise<ExternalUserProfile> {
    try {
      const client = await this.getLineClient(tenantId);
      const profile = await client.getProfile(externalUserId);

      return {
        displayName: profile.displayName || 'Unknown',
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        throw new Error('User profile not found');
      }
      this.logger.error(`Failed to get LINE user profile: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证 Webhook 签名
   * @security 🔒 验证 LINE Webhook 签名
   */
  async verifyWebhookSignature(signature: string, body: string, tenantId?: string): Promise<boolean> {
    return await this.channelConfigService.verifySignature('LINE', signature, body, tenantId);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
