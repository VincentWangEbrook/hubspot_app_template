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

  /**
   * 通用方法：根据 tenantId 切换到租户 schema 并执行回调
   */
  async withTenant<T>(tenantId: string, callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    // 1. 查租户元数据
    const tenant = await this.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) throw new Error(`租户 ${tenantId} 不存在`);

    // 2. 切换 schema 并执行回调
    // Sanitize tenantId to prevent SQL injection (though uuid is safe, good practice)
    const schemaName = `tenant_${tenantId.replace(/[^a-zA-Z0-9-]/g, '')}`;
    return this.useTenantSchema(schemaName, callback);
  }
}
