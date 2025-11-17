import { Module } from '@nestjs/common';
import { HubSpotService } from './hubspot.service';
import { HubSpotController } from './hubspot.controller';
import { TenantModule } from '../tenant/tenant.module';
import { JwtService } from '@nestjs/jwt';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [TenantModule, SharedModule],
  controllers: [HubSpotController],
  providers: [HubSpotService, JwtService],
  exports: [HubSpotService],
})
export class HubSpotModule {}
