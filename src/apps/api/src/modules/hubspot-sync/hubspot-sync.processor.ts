import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor('hubspot-sync')
export class HubspotSyncProcessor {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly multi: MultiChannelService
  ) {}

  @Process('syncToHubspot')
  async handle(job: Job) {
    const { tenantId, channelId, content } = job.data;
    const channel = await this.prismaService.withTenant(tenantId, async (prisma) => {
      return prisma.channel.findUnique({
        where: { id: channelId, tenantId },
      });
    });

    if (!channel) throw new Error(`channel ${channelId} not found`);

    // 保存已在 saveIncomingMessage 中完成，这里直接发送到 HubSpot
    await this.multi.sendMessageToHubspot(tenantId, channel, content, 'CONTACT');
  }
}
