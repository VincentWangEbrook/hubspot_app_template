/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { SchemaMigration } from './types';

export const migration: SchemaMigration = {
  version: '20251210000003_init_hubspot_conversations',
  description: 'Create hubspot_conversations table',
  up: (schema) => [
    `CREATE TABLE IF NOT EXISTS "${schema}"."hubspot_conversations" (
      "id" SERIAL NOT NULL,
      "tenant_id" UUID NOT NULL,
      "hubspot_contact_id" VARCHAR(100) NOT NULL,
      "conversation_id" VARCHAR(100) NOT NULL,
      "channel_id" INTEGER,
      "created_at" TIMESTAMP DEFAULT now() NOT NULL,
      CONSTRAINT "PK_hubspot_conversations_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_hubspot_conversations_tenant_contact_channel" UNIQUE ("tenant_id", "hubspot_contact_id", "channel_id"),
      CONSTRAINT "FK_hubspot_conversations_channel_id" FOREIGN KEY ("channel_id") REFERENCES "${schema}"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_conversations_tenant" ON "${schema}"."hubspot_conversations"("tenant_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_hubspot_conversations_contact" ON "${schema}"."hubspot_conversations"("hubspot_contact_id")`,
  ],
};

