import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface TableDefinition {
  name: string;
  createSQL: (schemaName: string) => string;
  indexes?: Array<(schemaName: string) => string>;
}

@Injectable()
export class SchemaManagerService {
  private readonly logger = new Logger(SchemaManagerService.name);
  
  // Cache to track which schemas have been checked/updated in this session
  private schemaCheckedCache = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Define all tenant tables - single source of truth
   * Add new tables here and they will be automatically created for all tenants
   */
  private getTableDefinitions(): TableDefinition[] {
    return [
      // Channels table
      {
        name: 'channels',
        createSQL: (schema) => `
          CREATE TABLE IF NOT EXISTS "${schema}"."channels" (
            "id" SERIAL NOT NULL,
            "tenantId" character varying NOT NULL,
            "provider" character varying NOT NULL,
            "channelId" character varying NOT NULL,
            "channelSecret" character varying,
            "channelAccessToken" text,
            "name" character varying,
            "isActive" boolean DEFAULT true,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_channels_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_channels_tenant_provider_channel" UNIQUE ("tenantId", "provider", "channelId")
          )`,
      },
      // Messages table
      {
        name: 'messages',
        createSQL: (schema) => `
          CREATE TABLE IF NOT EXISTS "${schema}"."messages" (
            "id" SERIAL NOT NULL,
            "tenantId" character varying NOT NULL,
            "conversationId" character varying NOT NULL,
            "channel_id" integer,
            "senderId" character varying,
            "text" text,
            "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
            CONSTRAINT "FK_messages_channel_id" FOREIGN KEY ("channel_id") REFERENCES "${schema}"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE
          )`,
      },
      // HubSpot Conversations table
      {
        name: 'hubspot_conversations',
        createSQL: (schema) => `
          CREATE TABLE IF NOT EXISTS "${schema}"."hubspot_conversations" (
            "id" SERIAL NOT NULL,
            "tenantId" character varying NOT NULL,
            "hubspotContactId" character varying NOT NULL,
            "conversationId" character varying NOT NULL,
            "channel_id" integer,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_hubspot_conversations_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_hubspot_conversations_tenant_contact_channel" UNIQUE ("tenantId", "hubspotContactId", "channel_id"),
            CONSTRAINT "FK_hubspot_conversations_channel_id" FOREIGN KEY ("channel_id") REFERENCES "${schema}"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE
          )`,
      },
      // HubSpot Contacts Cache table (with extensible fields)
      {
        name: 'hubspot_contacts',
        createSQL: (schema) => `
          CREATE TABLE IF NOT EXISTS "${schema}"."hubspot_contacts" (
            "id" SERIAL NOT NULL,
            "hubspot_id" VARCHAR(50) NOT NULL,
            "email" VARCHAR(255),
            "firstname" VARCHAR(100),
            "lastname" VARCHAR(100),
            "phone" VARCHAR(50),
            "company" VARCHAR(255),
            "job_title" VARCHAR(100),
            "lifecycle_stage" VARCHAR(100),
            "line_user_id" VARCHAR(100),
            "line_display_name" VARCHAR(255),
            "zip" VARCHAR(20),
            "properties" JSONB,
            "custom_properties" JSONB,
            "metadata" JSONB,
            "last_synced_at" TIMESTAMP,
            "is_deleted" BOOLEAN DEFAULT FALSE,
            "hubspot_created_at" TIMESTAMP,
            "hubspot_updated_at" TIMESTAMP,
            "created_at" TIMESTAMP DEFAULT now(),
            "updated_at" TIMESTAMP DEFAULT now(),
            CONSTRAINT "PK_hubspot_contacts_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_hubspot_contacts_hubspot_id" UNIQUE ("hubspot_id")
          )`,
        indexes: [
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_email" ON "${schema}"."hubspot_contacts"("email")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_line_user_id" ON "${schema}"."hubspot_contacts"("line_user_id")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_last_synced" ON "${schema}"."hubspot_contacts"("last_synced_at")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_is_deleted" ON "${schema}"."hubspot_contacts"("is_deleted") WHERE "is_deleted" = FALSE`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_properties" ON "${schema}"."hubspot_contacts" USING GIN("properties")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_custom_props" ON "${schema}"."hubspot_contacts" USING GIN("custom_properties")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_metadata" ON "${schema}"."hubspot_contacts" USING GIN("metadata")`,
        ],
      },
      // HubSpot Companies table (with extensible fields)
      {
        name: 'hubspot_companies',
        createSQL: (schema) => `
          CREATE TABLE IF NOT EXISTS "${schema}"."hubspot_companies" (
            "id" SERIAL NOT NULL,
            "hubspot_id" VARCHAR(50) NOT NULL,
            "name" VARCHAR(255),
            "domain" VARCHAR(255),
            "industry" VARCHAR(100),
            "city" VARCHAR(100),
            "state" VARCHAR(100),
            "country" VARCHAR(100),
            "zip" VARCHAR(20),
            "phone" VARCHAR(50),
            "website" VARCHAR(255),
            "description" TEXT,
            "num_employees" INTEGER,
            "annual_revenue" DECIMAL(15, 2),
            "type" VARCHAR(100),
            "line_channel_id" VARCHAR(100),
            "properties" JSONB,
            "custom_properties" JSONB,
            "metadata" JSONB,
            "last_synced_at" TIMESTAMP,
            "is_deleted" BOOLEAN DEFAULT FALSE,
            "hubspot_created_at" TIMESTAMP,
            "hubspot_updated_at" TIMESTAMP,
            "created_at" TIMESTAMP DEFAULT now(),
            "updated_at" TIMESTAMP DEFAULT now(),
            CONSTRAINT "PK_hubspot_companies_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_hubspot_companies_hubspot_id" UNIQUE ("hubspot_id")
          )`,
        indexes: [
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_hubspot_id" ON "${schema}"."hubspot_companies"("hubspot_id")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_name" ON "${schema}"."hubspot_companies"("name")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_domain" ON "${schema}"."hubspot_companies"("domain")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_industry" ON "${schema}"."hubspot_companies"("industry")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_last_synced" ON "${schema}"."hubspot_companies"("last_synced_at")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_is_deleted" ON "${schema}"."hubspot_companies"("is_deleted") WHERE "is_deleted" = FALSE`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_properties" ON "${schema}"."hubspot_companies" USING GIN("properties")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_custom_props" ON "${schema}"."hubspot_companies" USING GIN("custom_properties")`,
          (schema) => `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_metadata" ON "${schema}"."hubspot_companies" USING GIN("metadata")`,
        ],
      },
    ];
  }

  /**
   * Create tenant schema with all required tables
   */
  async createTenantSchema(tenantId: string) {
    const safeTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const schemaName = `tenant_${safeTenantId}`;

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Create Schema
        await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

        // 2. Create all tables from definitions
        const tables = this.getTableDefinitions();
        for (const table of tables) {
          await tx.$executeRawUnsafe(table.createSQL(schemaName));
          
          // Create indexes if defined
          if (table.indexes) {
            for (const indexSQL of table.indexes) {
              await tx.$executeRawUnsafe(indexSQL(schemaName));
            }
          }
        }
      });

      this.logger.log(`Schema ${schemaName} created/verified successfully.`);
    } catch (err) {
      this.logger.error(`Failed to create schema ${schemaName}`, err);
      throw err;
    }
  }

  /**
   * Ensure tenant schema is up-to-date with all required tables
   * Automatically detects and creates missing tables without hardcoding
   * Uses caching to prevent concurrent checks for the same tenant
   */
  async ensureSchemaUpToDate(tenantId: string): Promise<void> {
    const safeTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const schemaName = `tenant_${safeTenantId}`;

    // Check if we already have a check in progress or completed for this tenant
    const cachedCheck = this.schemaCheckedCache.get(tenantId);
    if (cachedCheck) {
      // Wait for the existing check to complete
      return cachedCheck;
    }

    // Create a new check promise and cache it
    const checkPromise = this._performSchemaCheck(tenantId, schemaName);
    this.schemaCheckedCache.set(tenantId, checkPromise);

    try {
      await checkPromise;
    } catch (err) {
      // Remove from cache on error so it can be retried
      this.schemaCheckedCache.delete(tenantId);
      throw err;
    }
  }

  /**
   * Internal method to actually perform the schema check
   */
  private async _performSchemaCheck(tenantId: string, schemaName: string): Promise<void> {
    this.logger.log(`Checking schema ${schemaName} for missing tables...`);

    try {
      // Get all table definitions
      const expectedTables = this.getTableDefinitions();
      
      // Check which tables are missing
      const missingTables: TableDefinition[] = [];
      
      for (const tableDef of expectedTables) {
        const exists = await this.checkTableExists(schemaName, tableDef.name);
        if (!exists) {
          missingTables.push(tableDef);
        }
      }

      // Create missing tables
      if (missingTables.length > 0) {
        this.logger.log(
          `Creating ${missingTables.length} missing table(s) in ${schemaName}: ${missingTables.map(t => t.name).join(', ')}`
        );

        await this.prisma.$transaction(async (tx) => {
          for (const table of missingTables) {
            // Create table
            await tx.$executeRawUnsafe(table.createSQL(schemaName));
            
            // Create indexes if defined
            if (table.indexes) {
              for (const indexSQL of table.indexes) {
                await tx.$executeRawUnsafe(indexSQL(schemaName));
              }
            }
            
            this.logger.log(`Created table ${table.name} in ${schemaName}`);
          }
        });

        this.logger.log(`Successfully created ${missingTables.length} missing table(s) in ${schemaName}`);
      } else {
        this.logger.log(`Schema ${schemaName} is up-to-date`);
      }
    } catch (err) {
      this.logger.error(`Failed to update schema ${schemaName}`, err);
      throw err; // Throw instead of swallowing the error
    }
  }

  /**
   * Clear the schema check cache (useful for testing or when you know schema changed)
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
   * Helper method to check if a table exists in a schema
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
}


