/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

export type ChannelType = 'LINE' | 'WECHAT' | 'WHATSAPP' | 'FACEBOOK';

export interface SendMessageParams {
  tenantId: string;
  externalUserId: string;  // LINE userId / WeChat openId
  content: string;
  messageType: 'text' | 'image' | 'file';
  metadata?: Record<string, any>;
}

export interface SendMessageResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface IncomingMessage {
  externalUserId: string;
  content: string;
  messageType: string;
  timestamp: Date;
  rawPayload: any;
  metadata?: Record<string, any>;
}

export interface ChannelEvent {
  type: 'follow' | 'unfollow' | 'message';
  externalUserId: string;
  timestamp: Date;
  data?: any;
}

export interface WebhookResult {
  messages: IncomingMessage[];
  events: ChannelEvent[];
}

export interface ExternalUserProfile {
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

/**
 * 渠道适配器接口 (Strategy Pattern)
 */
export interface IChannelAdapter {
  readonly channelType: ChannelType;
  
  /**
   * 发送消息到外部平台
   */
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  
  /**
   * 处理 Webhook 事件（接收消息）
   */
  handleWebhook(payload: any, tenantId: string): Promise<WebhookResult>;
  
  /**
   * 获取用户资料
   */
  getUserProfile(externalUserId: string, tenantId: string): Promise<ExternalUserProfile>;
  
  /**
   * 验证 Webhook 签名
   * @security 🔒 关键安全方法
   */
  verifyWebhookSignature(signature: string, body: string, tenantId?: string): Promise<boolean>;
}
