/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { ChatModule } from '../chat/chat.module';
import { ChannelModule } from '../channel/channel.module';

@Module({
  imports: [ChatModule, ChannelModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
