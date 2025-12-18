/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      this.client = new Redis({
        host: this.configService.get('REDIS_HOST') || '127.0.0.1',
        port: parseInt(this.configService.get('REDIS_PORT') || '6379', 10),
        password: this.configService.get('REDIS_PASSWORD') || undefined,
        db: parseInt(this.configService.get('REDIS_DB') || '0', 10),
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null; // 停止重试
          }
          return Math.min(times * 200, 2000); // 重试延迟
        },
      });

      await this.client.ping();
      this.logger.log('Redis service connected');
    } catch (error) {
      this.logger.warn('Redis not available, some features may not work');
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * 检查 Redis 是否可用
   */
  isConnected(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  /**
   * 获取值
   */
  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  /**
   * 设置值
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * 删除值
   */
  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  /**
   * 获取原始 Redis 客户端（用于高级操作）
   */
  getClient(): Redis | null {
    return this.client;
  }
}

