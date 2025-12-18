/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

/**
 * Tenant Schema Migrations
 * 
 * 迁移文件按版本号顺序排列，新迁移添加到数组末尾。
 * 每个迁移只会执行一次，已执行的迁移记录在 _schema_migrations 表中。
 * 
 * 新增迁移步骤：
 * 1. 创建新文件：migrations/YYYYMMDDHHMMSS_description.ts
 * 2. 导出 migration 对象
 * 3. 在下方导入并添加到 migrations 数组
 */

import { SchemaMigration } from './types';

// 按版本号顺序导入迁移
import { migration as initChannels } from './20251210000000_init_channels';
import { migration as initMessages } from './20251210000001_init_messages';
import { migration as initChannelConfigs } from './20251210000002_init_channel_configs';
import { migration as initHubspotConversations } from './20251210000003_init_hubspot_conversations';
import { migration as initHubspotContacts } from './20251210000004_init_hubspot_contacts';
import { migration as initHubspotCompanies } from './20251210000005_init_hubspot_companies';
import { migration as migrateHubspotConversationsColumns } from './20251217000001_migrate_hubspot_conversations_columns';

/**
 * 所有迁移脚本，按版本号顺序排列
 * 新迁移添加到数组末尾
 */
export const migrations: SchemaMigration[] = [
  // ==================== 初始化迁移 ====================
  initChannels,
  initMessages,
  initChannelConfigs,
  initHubspotConversations,
  initHubspotContacts,
  initHubspotCompanies,

  // ==================== 字段迁移 ====================
  migrateHubspotConversationsColumns,

  // ==================== 新增迁移请在此处添加 ====================
];

// 导出类型
export { SchemaMigration } from './types';

