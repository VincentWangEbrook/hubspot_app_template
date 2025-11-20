import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';
import { MessageListenerService } from '../hubspot/services/message-listener.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'hubspot-sync', redis: { host: 'localhost', port: 6379 } }),
  ],
  providers: [MultiChannelService, MessageListenerService],
  exports: [MultiChannelService, MessageListenerService],
})
export class HubspotSyncModule {}
