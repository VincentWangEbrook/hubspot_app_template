import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * 切换 schema，返回一个新的 PrismaService 实例（多租户）
   * 注意：只能在单次请求/事务中使用，避免全局污染
   */
  async useTenantSchema<T>(schema: string, callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    await this.$executeRawUnsafe(`SET search_path TO ${schema};`);
    try {
      return await callback(this);
    } finally {
      // 切回默认 schema（可选）
      await this.$executeRawUnsafe(`SET search_path TO public;`);
    }
  }
}
