-- Migration: Move chat tables to tenant schemas
-- Date: 2025-12-16
-- Description: Drop channels, messages, channel_configs, and hubspot_conversations tables from public schema
--              These tables are now managed in tenant-specific schemas via schema-manager.service.ts

-- Drop tables in correct order (respecting foreign key constraints)
-- Drop hubspot_conversations first (depends on channels)
DROP TABLE IF EXISTS "hubspot_conversations" CASCADE;

-- Drop messages (depends on channels)
DROP TABLE IF EXISTS "messages" CASCADE;

-- Drop channels
DROP TABLE IF EXISTS "channels" CASCADE;

-- Drop channel_configs
DROP TABLE IF EXISTS "channel_configs" CASCADE;

-- Note: These tables will be automatically created in each tenant schema
-- by the SchemaManagerService when tenants are accessed
