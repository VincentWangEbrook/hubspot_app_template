import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';

@Processor('hubspot-sync')
export class HubspotSyncProcessor {
  constructor(private readonly multi: MultiChannelService) {}

  @Process('syncToHubspot')
  async handle(job: Job) {
    const { tenantId, channelId, content } = job.data;
    const channelRepo = this.multi.getTenantDataSourceFactory().getChannelRepo(tenantId);
    const channel = await channelRepo.findOne({ where: { id: channelId } });
    if (!channel) throw new Error(`channel ${channelId} not found`);

    // 保存已在 saveIncomingMessage 中完成，这里直接发送到 HubSpot
    await this.multi.sendMessageToHubspot(tenantId, channel, content, 'CONTACT');
  }
}
