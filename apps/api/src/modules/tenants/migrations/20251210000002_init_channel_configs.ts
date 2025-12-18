/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { SchemaMigration } from './types';

export const migration: SchemaMigration = {
  version: '20251210000002_init_channel_configs',
  description: 'Create channel_configs table',
  up: (schema) => [
    `CREATE TABLE IF NOT EXISTS "${schema}"."channel_configs" (
      "id" UUID NOT NULL,
      "tenant_id" UUID NOT NULL,
      "channel_type" VARCHAR(50) NOT NULL,
      "credentials" TEXT NOT NULL,
      "is_active" BOOLEAN DEFAULT true NOT NULL,
      "webhook_url" TEXT,
      "created_at" TIMESTAMP DEFAULT now() NOT NULL,
      "updated_at" TIMESTAMP DEFAULT now() NOT NULL,
      CONSTRAINT "PK_channel_configs_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_channel_configs_tenant_type" UNIQUE ("tenant_id", "channel_type")
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_channel_configs_tenant" ON "${schema}"."channel_configs"("tenant_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_channel_configs_tenant_active" ON "${schema}"."channel_configs"("tenant_id", "is_active")`,
  ],
};

