/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { SchemaMigration } from './types';

export const migration: SchemaMigration = {
  version: '20251210000000_init_channels',
  description: 'Create channels table',
  up: (schema) => [
    `CREATE TABLE IF NOT EXISTS "${schema}"."channels" (
      "id" SERIAL NOT NULL,
      "tenant_id" UUID NOT NULL,
      "channel_type" VARCHAR(50) NOT NULL,
      "external_user_id" VARCHAR(255) NOT NULL,
      "hubspot_contact_id" VARCHAR(100) NOT NULL,
      "contact_name" VARCHAR(255),
      "contact_avatar" TEXT,
      "unread_count" INTEGER DEFAULT 0 NOT NULL,
      "last_message_at" TIMESTAMP,
      "status" VARCHAR(20) DEFAULT 'active' NOT NULL,
      "created_at" TIMESTAMP DEFAULT now() NOT NULL,
      "updated_at" TIMESTAMP DEFAULT now() NOT NULL,
      CONSTRAINT "PK_channels_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_channels_tenant_channel_external" UNIQUE ("tenant_id", "channel_type", "external_user_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_channels_tenant_status" ON "${schema}"."channels"("tenant_id", "status")`,
    `CREATE INDEX IF NOT EXISTS "idx_channels_tenant_last_message" ON "${schema}"."channels"("tenant_id", "last_message_at")`,
  ],
};

