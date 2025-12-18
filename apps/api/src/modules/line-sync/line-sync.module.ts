import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HubspotModule } from '../hubspot/hubspot.module';
import { LineModule } from '../line/line.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'line-sync', redis: { host: 'localhost', port: 6379 } }), HubspotModule, LineModule],
  providers: [],
})
export class LineSyncModule {}
