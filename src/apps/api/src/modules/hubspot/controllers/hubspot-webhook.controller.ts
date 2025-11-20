import { Controller, Post, Req, Body, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { MultiChannelService } from '../services/multi-channel.service';
import { TenantService } from '../../tenants/services/tenant.service';

@Controller('hubspot')
export class HubspotWebhookController {
  private readonly logger = new Logger(HubspotWebhookController.name);

  constructor(
    private readonly multi: MultiChannelService,
    private readonly tenantService: TenantService,
    @InjectQueue('line-sync') private readonly lineQueue: Queue,
  ) {}

  @Post('webhook')
  async handle(@Req() req, @Body() body: any) {
    // HubSpot 会发送一批事件（你需做验签）
    const events = body?.events ?? body?.objectType ? [body] : body;
    
    for (const ev of events) {
      // 根据 hubspot portalId -> tenantId 的映射
      const portalId = String(ev.portalId || ev.subscriptionId);
      const tenantId = await this.resolveTenantByPortal(portalId);
      
      if (!tenantId) {
        this.logger.warn(`Received webhook for unknown portalId: ${portalId}`);
        continue;
      }

      // 仅处理 conversation message created
      if (ev.eventType === 'conversation.message.created' || ev.objectType === 'conversation_message') {
        // HubSpot webhook payload 结构差异，请按你实际 webhook payload 解析 message id 或对象
        const messageId = ev.objectId ?? ev.id ?? ev.subscriptionId;
        // 尝试获取 conversationId
        const conversationId = ev.conversationId || ev.properties?.hs_conversation_id?.value;
        
        await this.lineQueue.add('hubspotToLine', { tenantId, messageId, conversationId });
      }
    }
    return { success: true };
  }

  private async resolveTenantByPortal(portalId: string): Promise<string | null> {
    const tenant = await this.tenantService.getTenant({ hubId: portalId });
    return tenant ? tenant.id : null;
  }
}
