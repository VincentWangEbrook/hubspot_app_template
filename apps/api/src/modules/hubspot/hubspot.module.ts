import { Module } from '@nestjs/common';
import { HubspotController } from './controllers/hubspot.controller';
import { HubspotWebhookController } from './controllers/hubspot-webhook.controller';
import { MultiChannelService } from './services/multi-channel.service';
import { HubspotClientFactory } from './services/hubspot-client.factory';
import { TenantModule } from '../tenants/tenant.module';
import { JwtService } from '@nestjs/jwt';
import { SharedModule } from '../../shared/shared.module';
import { BullModule } from '@nestjs/bull';
import { HubspotService } from './services/hubspot.service';

@Module({
  imports: [
    TenantModule, 
    SharedModule, 
    BullModule.registerQueue(
      {
        name: 'line-sync',
      },
      {
        name: 'hubspot-sync',
      },
    ),
  ],
  controllers: [HubspotController, HubspotWebhookController],
  providers: [JwtService, MultiChannelService, HubspotClientFactory, HubspotService],
  exports: [MultiChannelService, HubspotClientFactory, HubspotService],
})
export class HubspotModule {}
