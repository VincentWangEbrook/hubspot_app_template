/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { SchemaMigration } from './types';

export const migration: SchemaMigration = {
  version: '20251210000005_init_hubspot_companies',
  description: 'Create hubspot_companies table',
  up: (schema) => [
    `CREATE TABLE IF NOT EXISTS "${schema}"."hubspot_companies" (
      "id" SERIAL NOT NULL,
      "hubspot_id" VARCHAR(50) NOT NULL,
      "name" VARCHAR(255),
      "domain" VARCHAR(255),
      "properties" JSONB,
      "is_deleted" BOOLEAN DEFAULT FALSE,
      "last_synced_at" TIMESTAMP,
      "created_at" TIMESTAMP DEFAULT now(),
      "updated_at" TIMESTAMP DEFAULT now(),
      CONSTRAINT "PK_hubspot_companies_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_hubspot_companies_hubspot_id" UNIQUE ("hubspot_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_name" ON "${schema}"."hubspot_companies"("name")`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_domain" ON "${schema}"."hubspot_companies"("domain")`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_last_synced" ON "${schema}"."hubspot_companies"("last_synced_at")`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_is_deleted" ON "${schema}"."hubspot_companies"("is_deleted") WHERE "is_deleted" = FALSE`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_companies_properties" ON "${schema}"."hubspot_companies" USING GIN("properties")`,
  ],
};

