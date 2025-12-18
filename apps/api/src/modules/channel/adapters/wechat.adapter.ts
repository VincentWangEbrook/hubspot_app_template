/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IChannelAdapter,
  SendMessageParams,
  SendMessageResult,
  WebhookResult,
  ExternalUserProfile,
} from '../interfaces/channel-adapter.interface';
import { ChannelConfigService } from '../channel-config.service';

@Injectable()
export class WeChatChannelAdapter implements IChannelAdapter {
  readonly channelType = 'WECHAT' as const;
  private readonly logger = new Logger(WeChatChannelAdapter.name);

  constructor(private readonly channelConfigService: ChannelConfigService) {}

  /**
   * 发送消息到 WeChat（预留实现）
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    this.logger.warn('WeChat adapter not yet implemented');
    return {
      success: false,
      error: 'WeChat adapter not implemented',
    };
  }

  /**
   * 处理 WeChat Webhook 事件（预留实现）
   */
  async handleWebhook(payload: any, tenantId: string): Promise<WebhookResult> {
    this.logger.warn('WeChat webhook handler not yet implemented');
    return {
      messages: [],
      events: [],
    };
  }

  /**
   * 获取 WeChat 用户资料（预留实现）
   */
  async getUserProfile(externalUserId: string, tenantId: string): Promise<ExternalUserProfile> {
    throw new Error('WeChat getUserProfile not implemented');
  }

  /**
   * 验证 Webhook 签名
   * @security 🔒 验证 WeChat Webhook 签名
   */
  async verifyWebhookSignature(signature: string, body: string, tenantId?: string): Promise<boolean> {
    return await this.channelConfigService.verifySignature('WECHAT', signature, body, tenantId);
  }
}
