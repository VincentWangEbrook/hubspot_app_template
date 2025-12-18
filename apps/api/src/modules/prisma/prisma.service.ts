import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

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
   * 切换到指定 schema 并执行回调
   * 使用事务和 SET LOCAL search_path 防止竞态条件
   */
  async useTenantSchema<T>(schemaName: string, callback: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      // Use local search_path for this transaction only
      // usage of double quotes handles special characters
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schemaName}", public;`);
      return callback(tx);
    });
  }

  /**
   * 通用方法：根据 tenantId 切换到租户 schema 并执行回调
   */
  async withTenant<T>(tenantId: string, callback: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    // 1. 查租户元数据
    const tenant = await this.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) throw new Error(`租户 ${tenantId} 不存在`);

    // 2. 切换 schema 并执行回调
    // Sanitize tenantId to prevent SQL injection
    const safeId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const schemaName = `tenant_${safeId}`;
    return this.useTenantSchema(schemaName, callback);
  }
}
