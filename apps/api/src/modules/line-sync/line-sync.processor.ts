/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';
import { LineService } from '../line/services/line.service';
import { TenantPrismaService, TenantChannel, TenantHubspotConversation } from '../prisma/tenant-prisma.service';
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
        const mappings = await tx.$queryRaw<(TenantHubspotConversation & { 
          channelExternalUserId: string;
          channelChannelType: string;
          channelHubspotContactId: string;
        })[]>`
          SELECT 
            hc.id,
            hc.tenant_id as "tenantId",
            hc.hubspot_contact_id as "hubspotContactId",
            hc.conversation_id as "conversationId",
            hc.channel_id as "channelId",
            hc.created_at as "createdAt",
            c.external_user_id as "channelExternalUserId",
            c.channel_type as "channelChannelType",
            c.hubspot_contact_id as "channelHubspotContactId"
          FROM hubspot_conversations hc
          LEFT JOIN channels c ON c.id = hc.channel_id
          WHERE hc.tenant_id = ${tenantId}::uuid
            AND hc.conversation_id = ${conversationId}
          LIMIT 1
        `;

        const mapping = mappings[0];

        if (!mapping || !mapping.channelExternalUserId) {
          this.logger.warn(`LineSyncProcessor: No channel mapping found for conversation ${conversationId}`);
          return;
        }

        // Construct channel object
        const channel: TenantChannel = {
          id: mapping.channelId,
          tenantId: tenantId,
          channelType: mapping.channelChannelType,
          externalUserId: mapping.channelExternalUserId,
          hubspotContactId: mapping.channelHubspotContactId,
          contactName: null,
          contactAvatar: null,
          unreadCount: 0,
          lastMessageAt: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        // 发送消息
        await this.lineService.sendMessage(tenantId, channel.externalUserId, body);
        
        // 保存 outgoing 消息到 DB
        await this.multi.saveOutgoingMessage(tenantId, { channel, content: body });
      });
    }
  }
}
