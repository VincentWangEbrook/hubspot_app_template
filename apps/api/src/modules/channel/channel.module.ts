/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Module, Global } from '@nestjs/common';
import { ChannelConfigService } from './channel-config.service';
import { LineChannelAdapter } from './adapters/line.adapter';
import { WeChatChannelAdapter } from './adapters/wechat.adapter';
import { ChannelAdapterFactory } from './channel-adapter.factory';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    ChannelConfigService,
    LineChannelAdapter,
    WeChatChannelAdapter,
    ChannelAdapterFactory,
  ],
  exports: [
    ChannelConfigService,
    LineChannelAdapter,
    WeChatChannelAdapter,
    ChannelAdapterFactory,
  ],
})
export class ChannelModule {}
