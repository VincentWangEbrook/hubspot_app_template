/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global() // 全局模块，只需在 AppModule 导入一次
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

