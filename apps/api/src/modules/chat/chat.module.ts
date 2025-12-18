/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Module, Global } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LineModule } from '../line/line.module';
import { TenantModule } from '../tenants/tenant.module';
import { ChannelModule } from '../channel/channel.module';
import { HubspotModule } from '../hubspot/hubspot.module';

@Global()
@Module({
  imports: [
    LineModule, 
    TenantModule, 
    ChannelModule, 
    HubspotModule,
    // RedisModule 是全局模块，无需显式导入
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}
