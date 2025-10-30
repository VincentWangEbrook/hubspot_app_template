import { Module } from '@nestjs/common';
import { HubSpotService } from './hubspot.service';
import { HubSpotController } from './hubspot.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [HubSpotController],
  providers: [HubSpotService],
  exports: [HubSpotService],
})
export class HubSpotModule {}
