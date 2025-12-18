/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ChannelAdapterFactory } from '../channel/channel-adapter.factory';
import { ChatService } from '../chat/chat.service';
import { ChannelType } from '../channel/interfaces/channel-adapter.interface';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly channelAdapterFactory: ChannelAdapterFactory,
    private readonly chatService: ChatService,
  ) {}

  /**
   * 统一 Webhook 入口
   * POST /webhook/:channelType/:tenantId
   */
  @Post(':channelType/:tenantId')
  async handleWebhook(
    @Param('channelType') channelType: string,
    @Param('tenantId') tenantId: string,
    @Headers('x-line-signature') signature: string,
    @Body() payload: any,
  ) {
    this.logger.log(`Received ${channelType} webhook for tenant ${tenantId}`);

    try {
      // 1. 获取渠道适配器
      const adapter = this.channelAdapterFactory.getAdapter(channelType as ChannelType);

      // 🐛 修复: 防止 JSON 循环引用崩溃
      let body: string;
      try {
        body = JSON.stringify(payload);
      } catch (error: any) {
        this.logger.error(`Failed to stringify payload: ${error.message}`);
        throw new UnauthorizedException('Invalid payload format');
      }

      // 2. 验证签名 🔒
      const isValid = await adapter.verifyWebhookSignature(signature, body, tenantId);
      if (!isValid) {
        this.logger.warn(`Invalid webhook signature for ${channelType} tenant ${tenantId}`);
        throw new UnauthorizedException('Invalid webhook signature');
      }

      // 3. 解析 Webhook 事件
      const result = await adapter.handleWebhook(payload, tenantId);

      // 🐛 修复: 限制事件数组大小，防止内存耗尽
      const MAX_EVENTS = 100;
      if (result.messages.length > MAX_EVENTS) {
        this.logger.warn(`Too many messages in webhook: ${result.messages.length}, truncating to ${MAX_EVENTS}`);
        result.messages = result.messages.slice(0, MAX_EVENTS);
      }

      if (result.events.length > MAX_EVENTS) {
        this.logger.warn(`Too many events in webhook: ${result.events.length}, truncating to ${MAX_EVENTS}`);
        result.events = result.events.slice(0, MAX_EVENTS);
      }

      // 4. 处理消息
      let processedCount = 0;
      let errorCount = 0;

      for (const message of result.messages) {
        try {
          await this.chatService.handleIncomingMessage({
            tenantId,
            channelType,
            externalUserId: message.externalUserId,
            content: message.content,
            externalMessageId: (message.rawPayload as any)?.message?.id,
          });
          processedCount++;
        } catch (error: any) {
          this.logger.error(`Failed to process message: ${error.message}`);
          errorCount++;
        }
      }

      // 5. 处理事件（如 Follow）
      for (const event of result.events) {
        try {
          if (event.type === 'follow') {
            const profile = await adapter.getUserProfile(event.externalUserId);
            await this.chatService.handleChannelEvent({
              tenantId,
              channelType,
              eventType: event.type,
              externalUserId: event.externalUserId,
              userData: profile,
            });
            processedCount++;
          }
        } catch (error: any) {
          this.logger.error(`Failed to process event: ${error.message}`);
          errorCount++;
        }
      }

      return {
        success: true,
        processed: processedCount,
        ...(errorCount > 0 && { errors: errorCount }),
      };
    } catch (error: any) {
      this.logger.error(`Webhook error: ${error.message}`);
      throw error;
    }
  }
}
