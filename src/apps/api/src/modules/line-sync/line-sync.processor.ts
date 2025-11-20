import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';
import { LineService } from '../line/services/line.service';

@Processor('line-sync')
export class LineSyncProcessor {
  constructor(private readonly multi: MultiChannelService, private readonly lineService: LineService) {}

  @Process('hubspotToLine')
  async handle(job: Job) {
    const { tenantId, messageId } = job.data;

    // 1) read hubspot message
    const hsMessage = await this.multi.getHubspotMessageById(tenantId, messageId);
    // 解析 body & sender
    const body = hsMessage.properties?.hs_body ?? hsMessage.properties?.body ?? '';
    const senderType = hsMessage.properties?.hs_sender_type ?? 'USER';
    const hsSenderId = hsMessage.properties?.hs_sender_id;

    // 3) 如果消息来自客服（USER），则需要发到 Line 用户
    if (senderType === 'USER' || senderType === 'AGENT') {
      const conversationId = job.data.conversationId;
      if (!conversationId) {
        console.warn(`LineSyncProcessor: Tenant ${tenantId} Message ${messageId} missing conversationId`);
        return;
      }

      await this.multi.getTenantDataSourceFactory().runInTenantContext(tenantId, async ({ conversationRepo }) => {
        // 查找本地映射：HubSpot Conversation -> Channel
        const mapping = await conversationRepo.findOne({ 
          where: { conversationId }, 
          relations: ['channel'] 
        });

        if (!mapping || !mapping.channel) {
          console.warn(`LineSyncProcessor: No channel mapping found for conversation ${conversationId}`);
          return;
        }

        const channel = mapping.channel;
        
        // 发送消息
        await this.lineService.sendMessage(tenantId, channel.externalUserId, body);
        
        // 保存 outgoing 消息到 DB
        await this.multi.saveOutgoingMessage(tenantId, { channel, content: body });
      });
    }
  }
}
