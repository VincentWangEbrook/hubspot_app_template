import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { ConfigModule } from '@nestjs/config';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [ConfigModule, TenantModule],
  providers: [SubscriptionService],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
