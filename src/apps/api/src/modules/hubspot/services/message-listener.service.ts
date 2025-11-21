import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { MultiChannelService } from './multi-channel.service';
import { Channel } from '@prisma/client';

@Injectable()
export class MessageListenerService {
  constructor(
    private readonly multiChannelService: MultiChannelService,
    @InjectQueue('hubspot-sync') private readonly hubspotQueue: Queue,
  ) {}

  /**
   * 接收到用户消息
   */
  async onMessageReceived(
    tenantId: string,
    channelType: 'LINE' | 'WECHAT' | 'OTHER',
    externalUserId: string,
    content: string,
  ) {
    // 保存消息到 DB
    const channel: Channel = await this.multiChannelService.saveIncomingMessage(
      tenantId,
      {
        channelType,
        externalUserId,
        content,
      }
    );

    // 异步提交队列
    await this.hubspotQueue.add('sync', {
      tenantId,
      channelId: channel.id,
      content,
    });
  }
}
