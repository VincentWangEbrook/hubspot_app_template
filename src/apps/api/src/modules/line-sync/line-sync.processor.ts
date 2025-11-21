import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';
import { LineService } from '../line/services/line.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { Logger } from '@nestjs/common';

@Processor('line-sync')
export class LineSyncProcessor {
  private readonly logger = new Logger(LineSyncProcessor.name);

  constructor(
    private readonly multi: MultiChannelService,
    private readonly lineService: LineService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  @Process('hubspotToLine')
  async handle(job: Job) {
    const { tenantId, messageId } = job.data;

    // 1) read hubspot message
    const hsMessage = await this.multi.getHubspotMessageById(tenantId, messageId);
    // 解析 body & sender
    const body = hsMessage.body ?? '';
    const senderType = hsMessage.senderType ?? 'USER';

    // 3) 如果消息来自客服（USER），则需要发到 Line 用户
    if (senderType === 'USER' || senderType === 'AGENT') {
      const conversationId = job.data.conversationId;
      if (!conversationId) {
        this.logger.warn(`LineSyncProcessor: Tenant ${tenantId} Message ${messageId} missing conversationId`);
        return;
      }

      await this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
        // 查找本地映射：HubSpot Conversation -> Channel
        const mapping = await tx.hubspotConversation.findFirst({
          where: { 
            tenantId,
            conversationId,
          },
          include: { channel: true }
        });

        if (!mapping || !mapping.channel) {
          this.logger.warn(`LineSyncProcessor: No channel mapping found for conversation ${conversationId}`);
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
