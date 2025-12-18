/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { migrations, SchemaMigration } from '../migrations';

@Injectable()
export class SchemaManagerService {
  private readonly logger = new Logger(SchemaManagerService.name);
  
  // Cache to track which schemas have been checked/updated in this session
  private schemaCheckedCache = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 迁移版本记录表的创建 SQL
   * 每个 tenant schema 都有一个 _schema_migrations 表
   */
  private getMigrationsTableSQL(schemaName: string): string {
    return `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."_schema_migrations" (
        "version" VARCHAR(100) PRIMARY KEY,
        "description" VARCHAR(500),
        "executed_at" TIMESTAMP DEFAULT now() NOT NULL
      )
    `;
  }

  /**
   * 获取所有迁移脚本
   */
  private getMigrations(): SchemaMigration[] {
    return migrations;
  }

  /**
   * 创建新租户的 schema（运行所有迁移）
   */
  async createTenantSchema(tenantId: string) {
    const safeTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const schemaName = `tenant_${safeTenantId}`;

    try {
      // 1. Create Schema
      await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // 2. Create migrations table
      await this.prisma.$executeRawUnsafe(this.getMigrationsTableSQL(schemaName));

      // 3. Run all migrations
      await this.runPendingMigrations(schemaName);

      this.logger.log(`Schema ${schemaName} created/verified successfully.`);
    } catch (err) {
      this.logger.error(`Failed to create schema ${schemaName}`, err);
      throw err;
    }
  }

  /**
   * 确保租户 schema 是最新的
   * 使用缓存防止并发检查
   */
  async ensureSchemaUpToDate(tenantId: string): Promise<void> {
    const safeTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const schemaName = `tenant_${safeTenantId}`;

    // Check if we already have a check in progress or completed for this tenant
    const cachedCheck = this.schemaCheckedCache.get(tenantId);
    if (cachedCheck) {
      return cachedCheck;
    }

    // Create a new check promise and cache it
    const checkPromise = this._performSchemaCheck(schemaName);
    this.schemaCheckedCache.set(tenantId, checkPromise);

    try {
      await checkPromise;
    } catch (err) {
      this.schemaCheckedCache.delete(tenantId);
      throw err;
    }
  }

  /**
   * 执行 schema 检查和迁移
   */
  private async _performSchemaCheck(schemaName: string): Promise<void> {
    this.logger.log(`Checking schema ${schemaName} for pending migrations...`);

    try {
      // Ensure schema exists, create if not
      const schemaExists = await this.checkSchemaExists(schemaName);
      if (!schemaExists) {
        this.logger.log(`Schema ${schemaName} does not exist, creating...`);
        await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      }

      // Ensure migrations table exists
      await this.prisma.$executeRawUnsafe(this.getMigrationsTableSQL(schemaName));

      // Check if this is a legacy schema (has tables but no migration records)
      await this.baselineLegacySchema(schemaName);

      // Run pending migrations
      const migrationsRun = await this.runPendingMigrations(schemaName);

      if (migrationsRun > 0) {
        this.logger.log(`Schema ${schemaName}: ${migrationsRun} migration(s) applied`);
      } else {
        this.logger.log(`Schema ${schemaName} is up-to-date`);
      }
    } catch (err) {
      this.logger.error(`Failed to update schema ${schemaName}`, err);
      throw err;
    }
  }

  /**
   * 迁移版本与表名的映射
   * 用于精确检测哪些初始化迁移需要设置基线
   */
  private readonly migrationTableMap: Record<string, string> = {
    '20251210000000_init_channels': 'channels',
    '20251210000001_init_messages': 'messages',
    '20251210000002_init_channel_configs': 'channel_configs',
    '20251210000003_init_hubspot_conversations': 'hubspot_conversations',
    '20251210000004_init_hubspot_contacts': 'hubspot_contacts',
    '20251210000005_init_hubspot_companies': 'hubspot_companies',
  };

  /**
   * 为已存在的旧 schema 设置基线
   * 只有表已存在时，才将对应的初始化迁移标记为已执行
   */
  private async baselineLegacySchema(schemaName: string): Promise<void> {
    const executedVersions = await this.getExecutedMigrations(schemaName);
    
    // If there are already migration records, this is not a legacy schema
    if (executedVersions.size > 0) {
      return;
    }

    // Check if any table exists (indicates legacy schema)
    const channelsExists = await this.checkTableExists(schemaName, 'channels');
    if (!channelsExists) {
      return; // New schema, no need to baseline
    }

    this.logger.log(`Detected legacy schema ${schemaName}, checking existing tables for baseline...`);

    let baselineCount = 0;

    // Only baseline migrations for tables that actually exist
    for (const [version, tableName] of Object.entries(this.migrationTableMap)) {
      const tableExists = await this.checkTableExists(schemaName, tableName);
      
      if (tableExists) {
        try {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "${schemaName}"."_schema_migrations" ("version", "description") 
             VALUES ($1, $2) 
             ON CONFLICT ("version") DO NOTHING`,
            version,
            `[BASELINE] Table ${tableName} already exists`
          );
          baselineCount++;
          this.logger.log(`Baseline: ${version} (table ${tableName} exists)`);
        } catch (err) {
          this.logger.warn(`Failed to baseline migration ${version}: ${err}`);
        }
      } else {
        this.logger.log(`Table ${tableName} does not exist, migration ${version} will run`);
      }
    }

    if (baselineCount > 0) {
      this.logger.log(`Baseline set for ${baselineCount} existing table(s) in ${schemaName}`);
    }
  }

  /**
   * 检查表是否存在
   */
  private async checkTableExists(schemaName: string, tableName: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = $2
      ) as exists`,
      schemaName,
      tableName
    );
    return result[0]?.exists || false;
  }

  /**
   * 运行所有待执行的迁移
   */
  private async runPendingMigrations(schemaName: string): Promise<number> {
    const allMigrations = this.getMigrations();
    const executedVersions = await this.getExecutedMigrations(schemaName);
    
    let migrationsRun = 0;

    for (const migration of allMigrations) {
      if (executedVersions.has(migration.version)) {
        continue; // 跳过已执行的迁移
      }

      this.logger.log(`Running migration ${migration.version}: ${migration.description}`);

      try {
        await this.prisma.$transaction(async (tx) => {
          // Execute all SQL statements in the migration
          const statements = migration.up(schemaName);
          for (const sql of statements) {
            await tx.$executeRawUnsafe(sql);
          }

          // Record the migration as executed
          await tx.$executeRawUnsafe(
            `INSERT INTO "${schemaName}"."_schema_migrations" ("version", "description") VALUES ($1, $2)`,
            migration.version,
            migration.description
          );
        });

        migrationsRun++;
        this.logger.log(`Migration ${migration.version} completed successfully`);
      } catch (err) {
        this.logger.error(`Migration ${migration.version} failed`, err);
        throw err;
      }
    }

    return migrationsRun;
  }

  /**
   * 获取已执行的迁移版本
   */
  private async getExecutedMigrations(schemaName: string): Promise<Set<string>> {
    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ version: string }>>(
        `SELECT version FROM "${schemaName}"."_schema_migrations" ORDER BY version`
      );
      return new Set(result.map(r => r.version));
    } catch {
      // Table might not exist yet
      return new Set();
    }
  }

  /**
   * 检查 schema 是否存在
   */
  private async checkSchemaExists(schemaName: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = $1
      ) as exists`,
      schemaName
    );
    return result[0]?.exists || false;
  }

  /**
   * 清除 schema 检查缓存
   */
  clearSchemaCache(tenantId?: string): void {
    if (tenantId) {
      this.schemaCheckedCache.delete(tenantId);
      this.logger.log(`Cleared schema cache for tenant ${tenantId}`);
    } else {
      this.schemaCheckedCache.clear();
      this.logger.log('Cleared all schema caches');
    }
  }

  /**
   * 获取迁移状态（调试用）
   */
  async getMigrationStatus(tenantId: string): Promise<{
    total: number;
    executed: number;
    pending: string[];
  }> {
    const safeTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const schemaName = `tenant_${safeTenantId}`;
    
    const allMigrations = this.getMigrations();
    const executedVersions = await this.getExecutedMigrations(schemaName);
    
    const pending = allMigrations
      .filter(m => !executedVersions.has(m.version))
      .map(m => m.version);

    return {
      total: allMigrations.length,
      executed: executedVersions.size,
      pending,
    };
  }
}
