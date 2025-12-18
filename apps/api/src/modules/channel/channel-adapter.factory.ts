/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable } from '@nestjs/common';
import {
  IChannelAdapter,
  ChannelType,
} from './interfaces/channel-adapter.interface';
import { LineChannelAdapter } from './adapters/line.adapter';
import { WeChatChannelAdapter } from './adapters/wechat.adapter';

@Injectable()
export class ChannelAdapterFactory {
  private adapters: Map<string, IChannelAdapter>;

  constructor(
    private readonly lineAdapter: LineChannelAdapter,
    private readonly wechatAdapter: WeChatChannelAdapter,
  ) {
    this.adapters = new Map<string, IChannelAdapter>([
      ['LINE', lineAdapter as IChannelAdapter],
      ['WECHAT', wechatAdapter as IChannelAdapter],
    ]);
  }

  /**
   * 获取指定渠道的适配器
   */
  getAdapter(channelType: ChannelType): IChannelAdapter {
    const adapter = this.adapters.get(channelType);
    if (!adapter) {
      throw new Error(`Unsupported channel type: ${channelType}`);
    }
    return adapter;
  }

  /**
   * 动态注册新的适配器
   */
  registerAdapter(adapter: IChannelAdapter): void {
    this.adapters.set(adapter.channelType, adapter);
  }

  /**
   * 获取所有支持的渠道类型
   */
  getSupportedChannels(): ChannelType[] {
    return Array.from(this.adapters.keys()) as ChannelType[];
  }
}
