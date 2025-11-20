import { Module } from '@nestjs/common';
import { LineController } from './controllers/line.controller';
import { LineWebhookController } from './controllers/line-webhook.controller';
import { LineService } from './services/line.service';
import { LineConfigService } from './services/line-config.service';
import { HubspotModule } from '../hubspot/hubspot.module';
import { TenantModule } from '../tenants/tenant.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    ConfigModule,
    HubspotModule,
    TenantModule,
    BullModule.registerQueue({ name: 'hubspot-sync' })
  ],
  controllers: [LineController, LineWebhookController],
  providers: [LineService, LineConfigService],
  exports: [LineService, LineConfigService],
})
export class LineModule {}