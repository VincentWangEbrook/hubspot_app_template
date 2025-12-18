/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

/**
 * 迁移脚本接口
 * 每个迁移有唯一版本号，只会执行一次
 */
export interface SchemaMigration {
  /** 版本号，格式：YYYYMMDDHHMMSS_description */
  version: string;
  /** 迁移描述 */
  description: string;
  /** 升级 SQL 语句数组 */
  up: (schemaName: string) => string[];
}

