import { Injectable } from '@nestjs/common';
import { MultiChannelService } from '../hubspot/services/multi-channel.service';
import { TenantDataSourceFactory } from '../hubspot/services/tenant-data-source.factory';
import { Channel } from '../hubspot/entities/channel.entity';

// NOTE: 你要实现真实的 Line Messaging API 发送逻辑（replace TODO）
@Injectable()
export class LineService {
  constructor(
    private readonly multi: MultiChannelService,
    private readonly tenantDSFactory: TenantDataSourceFactory,
  ) {}

  // 保存 incoming 并异步交给 queue（listener 会做 queue）
  async saveIncoming(tenantId: string, lineUserId: string, content: string) {
    return this.multi.saveIncomingMessage(tenantId, { channelType: 'LINE', externalUserId: lineUserId, content });
  }

  // 真实调用 Line Messaging API 发送消息
  async sendMessage(tenantId: string, lineUserId: string, content: string) {
    // TODO: 从 tenant 配置读取 Line channel token，然后调用 Line Messaging API
    // 举例（伪代码）:
    // await axios.post('https://api.line.me/v2/bot/message/push', { to: lineUserId, messages: [{ type: 'text', text: content }] }, { headers: { Authorization: `Bearer ${token}` }});
    return true;
  }
}
