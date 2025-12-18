/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { SchemaMigration } from './types';

/**
 * 历史迁移：将 hubspot_conversations 表的 camelCase 字段名修改为 snake_case
 * 新建的 tenant schema 不需要执行这些迁移（因为初始化迁移已使用正确的字段名）
 */
export const migration: SchemaMigration = {
  version: '20251217000001_migrate_hubspot_conversations_columns',
  description: 'Rename hubspot_conversations columns from camelCase to snake_case',
  up: (schema) => [
    // 检查并重命名 tenantId -> tenant_id
    `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = '${schema}' 
        AND table_name = 'hubspot_conversations' 
        AND column_name = 'tenantId'
      ) THEN
        -- Drop old constraint
        ALTER TABLE "${schema}"."hubspot_conversations" 
          DROP CONSTRAINT IF EXISTS "UQ_hubspot_conversations_tenant_contact_channel";
        -- Rename columns
        ALTER TABLE "${schema}"."hubspot_conversations" RENAME COLUMN "tenantId" TO "tenant_id";
        ALTER TABLE "${schema}"."hubspot_conversations" ALTER COLUMN "tenant_id" TYPE UUID USING "tenant_id"::UUID;
      END IF;
    END $$`,
    // 检查并重命名 hubspotContactId -> hubspot_contact_id
    `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = '${schema}' 
        AND table_name = 'hubspot_conversations' 
        AND column_name = 'hubspotContactId'
      ) THEN
        ALTER TABLE "${schema}"."hubspot_conversations" RENAME COLUMN "hubspotContactId" TO "hubspot_contact_id";
        ALTER TABLE "${schema}"."hubspot_conversations" ALTER COLUMN "hubspot_contact_id" TYPE VARCHAR(100);
      END IF;
    END $$`,
    // 检查并重命名 conversationId -> conversation_id
    `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = '${schema}' 
        AND table_name = 'hubspot_conversations' 
        AND column_name = 'conversationId'
      ) THEN
        ALTER TABLE "${schema}"."hubspot_conversations" RENAME COLUMN "conversationId" TO "conversation_id";
        ALTER TABLE "${schema}"."hubspot_conversations" ALTER COLUMN "conversation_id" TYPE VARCHAR(100);
      END IF;
    END $$`,
    // 检查并重命名 createdAt -> created_at
    `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = '${schema}' 
        AND table_name = 'hubspot_conversations' 
        AND column_name = 'createdAt'
      ) THEN
        ALTER TABLE "${schema}"."hubspot_conversations" RENAME COLUMN "createdAt" TO "created_at";
      END IF;
    END $$`,
    // 重建 unique constraint
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = '${schema}' 
        AND table_name = 'hubspot_conversations' 
        AND constraint_name = 'UQ_hubspot_conversations_tenant_contact_channel'
      ) THEN
        ALTER TABLE "${schema}"."hubspot_conversations" 
          ADD CONSTRAINT "UQ_hubspot_conversations_tenant_contact_channel" 
          UNIQUE ("tenant_id", "hubspot_contact_id", "channel_id");
      END IF;
    END $$`,
  ],
};

