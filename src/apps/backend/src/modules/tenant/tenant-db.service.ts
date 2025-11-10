import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class TenantDbService {
  private readonly logger = new Logger(TenantDbService.name);

  constructor(private readonly dataSource: DataSource) {}

  schemaNameForTenant(tenantId: string): string {
    // schema name: t_<uuid without dashes>
    const safe = tenantId.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    return `t_${safe}`;
  }

  async ensureSchema(tenantId: string) {
    const schema = this.schemaNameForTenant(tenantId);
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    // minimal per-tenant table example: contacts mirror table
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."contacts" (
        id varchar(64) primary key,
        email text,
        properties jsonb,
        synced_at timestamptz default now()
      )`
    );
  }

  async runInTenantSchema<T>(tenantId: string, callback: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const schema = this.schemaNameForTenant(tenantId);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query(`SET search_path TO "${schema}", public`);
      const result = await callback(runner);
      await runner.commitTransaction();
      return result;
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }
}


