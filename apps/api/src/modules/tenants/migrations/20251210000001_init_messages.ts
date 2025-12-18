/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { SchemaMigration } from './types';

export const migration: SchemaMigration = {
  version: '20251210000001_init_messages',
  description: 'Create messages table',
  up: (schema) => [
    `CREATE TABLE IF NOT EXISTS "${schema}"."messages" (
      "id" SERIAL NOT NULL,
      "channel_id" INTEGER NOT NULL,
      "tenant_id" UUID NOT NULL,
      "content" TEXT NOT NULL,
      "is_from_user" BOOLEAN NOT NULL,
      "message_type" VARCHAR(20) DEFAULT 'text' NOT NULL,
      "sender_id" UUID,
      "external_id" VARCHAR(255),
      "status" VARCHAR(20) DEFAULT 'sent' NOT NULL,
      "metadata" JSONB,
      "read_at" TIMESTAMP,
      "created_at" TIMESTAMP DEFAULT now() NOT NULL,
      CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_messages_channel_id" FOREIGN KEY ("channel_id") REFERENCES "${schema}"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_messages_channel_created" ON "${schema}"."messages"("channel_id", "created_at")`,
    `CREATE INDEX IF NOT EXISTS "idx_messages_tenant" ON "${schema}"."messages"("tenant_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_messages_external_id" ON "${schema}"."messages"("external_id")`,
  ],
};

