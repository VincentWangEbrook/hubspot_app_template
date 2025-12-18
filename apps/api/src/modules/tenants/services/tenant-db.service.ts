import { Injectable, Logger } from '@nestjs/common';
import { SchemaManagerService } from './schema-manager.service';

@Injectable()
export class TenantDbService {
  private readonly logger = new Logger(TenantDbService.name);

  constructor(private readonly schemaManager: SchemaManagerService) {}

  /**
   * Ensure the tenant-specific PostgreSQL schema exists.
   * Delegates to SchemaManagerService for actual schema creation.
   */
  async ensureSchema(tenantId: string): Promise<void> {
    try {
      await this.schemaManager.createTenantSchema(tenantId);
      this.logger.log(`Ensured schema for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to ensure schema for tenant ${tenantId}`, error);
      throw error;
    }
  }
}

