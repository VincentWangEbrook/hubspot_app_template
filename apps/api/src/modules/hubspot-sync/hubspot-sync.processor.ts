/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';
import { TenantPrismaService, TenantChannel } from '../prisma/tenant-prisma.service';

@Processor('hubspot-sync')
export class HubspotSyncProcessor {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly multi: MultiChannelService
  ) {}

  @Process('syncToHubspot')
  async handle(job: Job) {
    const { tenantId, channelId, content } = job.data;
    
    const channel = await this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const channels = await tx.$queryRaw<TenantChannel[]>`
        SELECT 
          id,
          tenant_id as "tenantId",
          channel_type as "channelType",
          external_user_id as "externalUserId",
          hubspot_contact_id as "hubspotContactId",
          contact_name as "contactName",
          contact_avatar as "contactAvatar",
          unread_count as "unreadCount",
          last_message_at as "lastMessageAt",
          status,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM channels
        WHERE id = ${channelId} AND tenant_id = ${tenantId}::uuid
        LIMIT 1
      `;
      return channels[0] || null;
    });

    if (!channel) throw new Error(`channel ${channelId} not found`);

    // 保存已在 saveIncomingMessage 中完成，这里直接发送到 HubSpot
    await this.multi.sendMessageToHubspot(tenantId, channel, content, 'CONTACT');
  }
}
