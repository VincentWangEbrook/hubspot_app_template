/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { SchemaMigration } from './types';

export const migration: SchemaMigration = {
  version: '20251210000004_init_hubspot_contacts',
  description: 'Create hubspot_contacts table',
  up: (schema) => [
    `CREATE TABLE IF NOT EXISTS "${schema}"."hubspot_contacts" (
      "id" SERIAL NOT NULL,
      "hubspot_id" VARCHAR(50) NOT NULL,
      "email" VARCHAR(255),
      "firstname" VARCHAR(100),
      "lastname" VARCHAR(100),
      "properties" JSONB,
      "is_deleted" BOOLEAN DEFAULT FALSE,
      "last_synced_at" TIMESTAMP,
      "created_at" TIMESTAMP DEFAULT now(),
      "updated_at" TIMESTAMP DEFAULT now(),
      CONSTRAINT "PK_hubspot_contacts_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_hubspot_contacts_hubspot_id" UNIQUE ("hubspot_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_email" ON "${schema}"."hubspot_contacts"("email")`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_firstname" ON "${schema}"."hubspot_contacts"("firstname")`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_lastname" ON "${schema}"."hubspot_contacts"("lastname")`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_last_synced" ON "${schema}"."hubspot_contacts"("last_synced_at")`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_is_deleted" ON "${schema}"."hubspot_contacts"("is_deleted") WHERE "is_deleted" = FALSE`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_contacts_properties" ON "${schema}"."hubspot_contacts" USING GIN("properties")`,
  ],
};

