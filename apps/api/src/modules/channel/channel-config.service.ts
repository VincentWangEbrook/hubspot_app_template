/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, Optional, Logger } from '@nestjs/common';
import { TenantPrismaService, TenantChannelConfig } from '../prisma/tenant-prisma.service';
import { ChannelType } from './interfaces/channel-adapter.interface';
import * as crypto from 'crypto';

interface ChannelCredentials {
  [key: string]: any;
}

@Injectable()
export class ChannelConfigService {
  private readonly logger = new Logger(ChannelConfigService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Optional() private readonly encryptionService?: any,
  ) {}

  /**
   * 获取租户的渠道配置
   */
  async getConfig(tenantId: string, channelType: ChannelType): Promise<any> {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const configs = await tx.$queryRaw<TenantChannelConfig[]>`
        SELECT 
          id,
          tenant_id as "tenantId",
          channel_type as "channelType",
          credentials,
          is_active as "isActive",
          webhook_url as "webhookUrl",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM channel_configs
        WHERE tenant_id = ${tenantId}::uuid AND channel_type = ${channelType}
        LIMIT 1
      `;

      const config = configs[0];

      if (!config || !config.isActive) {
        throw new Error(`Channel config not found or inactive: ${channelType}`);
      }

      // 解密凭证
      if (this.encryptionService) {
        const credentials = this.encryptionService.decrypt(config.credentials);
        return JSON.parse(credentials);
      }
      // 测试环境或未加密
      return JSON.parse(config.credentials);
    });
  }

  /**
   * 保存渠道配置
   */
  async saveConfig(
    tenantId: string,
    channelType: ChannelType,
    credentials: ChannelCredentials,
    webhookUrl?: string,
  ): Promise<void> {
    // 加密凭证
    const encryptedCredentials = this.encryptionService
      ? this.encryptionService.encrypt(JSON.stringify(credentials))
      : JSON.stringify(credentials);

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // Check if config exists
      const existing = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM channel_configs
        WHERE tenant_id = ${tenantId}::uuid AND channel_type = ${channelType}
        LIMIT 1
      `;

      if (existing.length > 0) {
        // Update existing config
        await tx.$executeRaw`
          UPDATE channel_configs
          SET credentials = ${encryptedCredentials},
              webhook_url = ${webhookUrl || null},
              updated_at = NOW()
          WHERE tenant_id = ${tenantId}::uuid AND channel_type = ${channelType}
        `;
      } else {
        // Insert new config
        const newId = crypto.randomUUID();
        await tx.$executeRaw`
          INSERT INTO channel_configs (
            id, tenant_id, channel_type, credentials, webhook_url, is_active, created_at, updated_at
          )
          VALUES (
            ${newId}::uuid, ${tenantId}::uuid, ${channelType}, ${encryptedCredentials},
            ${webhookUrl || null}, true, NOW(), NOW()
          )
        `;
      }
    });
  }

  /**
   * 验证 Webhook 签名
   * @security 🔒 关键安全方法：验证外部 Webhook 请求的真实性
   */
  async verifySignature(
    channelType: ChannelType,
    signature: string,
    body: string,
    tenantId?: string,
  ): Promise<boolean> {
    try {
      // 根据渠道类型验证签名
      switch (channelType) {
        case 'LINE':
          return await this.verifyLineSignature(signature, body, tenantId);
        case 'WECHAT':
          return await this.verifyWeChatSignature(signature, body, tenantId);
        default:
          this.logger.warn(`Unknown channel type: ${channelType}`);
          return false;
      }
    } catch (error: any) {
      this.logger.error(`Signature verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * 验证 LINE Webhook 签名
   * @security 🔒 使用 HMAC-SHA256 验证 LINE Webhook 签名
   */
  private async verifyLineSignature(signature: string, body: string, tenantId?: string): Promise<boolean> {
    if (!signature || !body) {
      return false;
    }

    try {
      // 从环境变量或配置中获取 channel secret（优先租户配置）
      let channelSecret: string;
      
      if (tenantId) {
        try {
          const config = await this.getConfig(tenantId, 'LINE');
          channelSecret = config.channelSecret;
        } catch {
          // 降级到全局配置
          channelSecret = process.env.LINE_CHANNEL_SECRET || '';
        }
      } else {
        channelSecret = process.env.LINE_CHANNEL_SECRET || '';
      }

      if (!channelSecret) {
        throw new Error('LINE channel secret not configured');
      }

      // LINE 使用 HMAC-SHA256
      const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(body)
        .digest('base64');

      // 🐛 修复: 检查签名长度是否匹配，防止 timingSafeEqual 崩溃
      const signatureBuffer = Buffer.from(signature);
      const hashBuffer = Buffer.from(hash);
      
      if (signatureBuffer.length !== hashBuffer.length) {
        this.logger.warn(`Signature length mismatch: expected ${hashBuffer.length}, got ${signatureBuffer.length}`);
        return false;
      }

      // 使用时间安全的比较防止时序攻击
      return crypto.timingSafeEqual(signatureBuffer, hashBuffer);
    } catch (error: any) {
      this.logger.error(`LINE signature verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 验证 WeChat Webhook 签名
   * @security 🔒 使用 SHA1 验证 WeChat Webhook 签名
   */
  private async verifyWeChatSignature(signature: string, body: string, tenantId?: string): Promise<boolean> {
    if (!signature || !body) {
      return false;
    }

    try {
      // 从环境变量或配置中获取 token
      let wechatToken: string;
      
      if (tenantId) {
        try {
          const config = await this.getConfig(tenantId, 'WECHAT');
          wechatToken = config.token;
        } catch {
          wechatToken = process.env.WECHAT_TOKEN || '';
        }
      } else {
        wechatToken = process.env.WECHAT_TOKEN || '';
      }

      if (!wechatToken) {
        throw new Error('WeChat token not configured');
      }

      // WeChat 使用 SHA1 (token + timestamp + nonce) 的方式
      // 这里简化处理，实际需要解析 query 参数
      const hash = crypto
        .createHash('sha1')
        .update(wechatToken + body)
        .digest('hex');

      // 🐛 修复: 检查签名长度是否匹配
      const signatureBuffer = Buffer.from(signature);
      const hashBuffer = Buffer.from(hash);
      
      if (signatureBuffer.length !== hashBuffer.length) {
        this.logger.warn(`WeChat signature length mismatch: expected ${hashBuffer.length}, got ${signatureBuffer.length}`);
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, hashBuffer);
    } catch (error: any) {
      this.logger.error(`WeChat signature verification failed: ${error.message}`);
      return false;
    }
  }
}
