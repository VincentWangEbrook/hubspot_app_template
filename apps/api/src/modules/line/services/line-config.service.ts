import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientConfig } from '@line/bot-sdk';

@Injectable()
export class LineConfigService {
  constructor(private configService: ConfigService) {}

  // 获取 Line Client 配置
  getClientConfig(): ClientConfig {
    return {
      channelAccessToken: this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN')!,
      channelSecret: this.configService.get<string>('LINE_CHANNEL_SECRET')!,
    };
  }

  // 获取 Webhook 验证密钥
  getChannelSecret(): string {
    return this.configService.get<string>('LINE_CHANNEL_SECRET')!;
  }
}