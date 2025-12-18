/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@hubspot/api-client';
import { TenantService } from '../../tenants/services/tenant.service';
import { TenantDbService } from '../../tenants/services/tenant-db.service';
import { FilterOperatorEnum, AssociationSpecAssociationCategoryEnum } from '@hubspot/api-client/lib/codegen/crm/contacts';
import { handleTenantException } from '../../../common/utils/tenant/tenant-error-handler.util';
import { HubspotClientFactory } from './hubspot-client.factory';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { ChatGateway } from '../../chat/chat.gateway';
import { HubspotWebhookEventDto } from '../dtos/hubspot-webhook.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService, TenantHubspotContact, TenantHubspotCompany } from '../../prisma/tenant-prisma.service';
import { ContactFiltersDto, PaginatedResponse, SyncResult } from '../dtos/contact.dto';
import { SchemaManagerService } from '../../tenants/services/schema-manager.service';

@Injectable()
export class HubspotService {
  private readonly logger = new Logger(HubspotService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantDb: TenantDbService,
    private readonly hubspotClientFactory: HubspotClientFactory,
    @InjectQueue('line-sync') private readonly lineQueue: Queue,
    @InjectQueue('hubspot-sync') private readonly hubspotSyncQueue: Queue,
    private readonly chatGateway: ChatGateway,
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly schemaManager: SchemaManagerService,
  ) {}

  async handleWebhook(body: any) {
    const events = body?.events ?? body?.objectType ? [body] : body;
    
    for (const ev of events) {
      try {
        await this.processEvent(ev);
      } catch (error) {
        this.logger.error(`Error processing event ${ev.id}: ${error}`);
      }
    }
  }

  private async processEvent(ev: any) {
    // 根据 hubspot portalId -> tenantId 的映射
    const portalId = String(ev.portalId || ev.subscriptionId);
    const tenantId = await this.resolveTenantByPortal(portalId);
    
    if (!tenantId) {
      this.logger.warn(`Received webhook for unknown portalId: ${portalId}`);
      return;
    }

    // 仅处理 conversation message created
    if (ev.eventType === 'conversation.message.created' || ev.objectType === 'conversation_message') {
      // HubSpot webhook payload 结构差异，请按你实际 webhook payload 解析 message id 或对象
      const messageId = ev.objectId ?? ev.id ?? ev.subscriptionId;
      // 尝试获取 conversationId
      const conversationId = ev.conversationId || ev.properties?.hs_conversation_id?.value;
      
      await this.lineQueue.add('hubspotToLine', { tenantId, messageId, conversationId });

      // Fetch content
      const content = await this.getMessageContent(tenantId, messageId);

      // Emit WebSocket event
      this.chatGateway.emitMessageToRoom(tenantId, {
        event: 'message.created',
        data: {
          id: messageId,
          conversationId,
          source: 'HUBSPOT',
          content,
        },
      });
    }
  }

  private async resolveTenantByPortal(portalId: string): Promise<string | null> {
    const tenant = await this.tenantService.getTenant({ hubspot_id: portalId });
    return tenant ? tenant.id : null;
  }

  async findContactByProperty(tenantId: string, property: string, value: string) {
    const client = await this.hubspotClientFactory.getClient(tenantId);
    const filter = { propertyName: property, operator: FilterOperatorEnum.Eq, value };
    const searchRequest = { filterGroups: [{ filters: [filter] }], properties: ['email', 'firstname', 'lastname', 'line_user_id'] };
    
    const result = await client.crm.contacts.searchApi.doSearch(searchRequest);
    return result.results[0] || null;
  }

  verifySignature(signature: string, rawBody: string): boolean {
    const secret = process.env.HUBSPOT_CLIENT_SECRET;
    if (!secret) {
      this.logger.warn('HUBSPOT_CLIENT_SECRET not set, skipping signature verification');
      return true;
    }
    // HubSpot signature v3: SHA-256 of clientSecret + requestBody
    const sourceString = secret + rawBody;
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(sourceString).digest('hex');
    return signature === hash;
  }

  async createContact(tenantId: string, properties: Record<string, string>) {
    const client = await this.hubspotClientFactory.getClient(tenantId);
    return await client.crm.contacts.basicApi.create({ properties });
  }

  async updateContact(tenantId: string, contactId: string, properties: Record<string, string>) {
    const client = await this.hubspotClientFactory.getClient(tenantId);
    return await client.crm.contacts.basicApi.update(contactId, { properties });
  }

  async getMessageContent(tenantId: string, messageId: string): Promise<string> {
    try {
      const client = await this.hubspotClientFactory.getClient(tenantId);
      return "New message from HubSpot"; 
    } catch (error: any) {
      this.logger.error(`Failed to fetch message content for ${messageId}: ${error.message}`);
      return "New message (content unavailable)";
    }
  }

  /**
   * Get contacts from local database (preferred method)
   * Returns cached contacts from tenant schema for better performance
   */
  async getContacts(tenantId: string): Promise<any[]> {
    try {
      // Ensure schema is up-to-date
      await this.schemaManager.ensureSchemaUpToDate(tenantId);
      
      // Fetch from local database
      const result = await this.getContactsFromDb(tenantId, {
        page: 1,
        limit: 10000, // Get all contacts (adjust as needed)
        sortBy: 'updated_at',
        sortOrder: 'desc',
      });
      
      return result.data || [];
    } catch (error: any) {
      this.logger.error(`Failed to fetch contacts from DB for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch contacts directly from HubSpot API
   * Use this only when you need real-time data from HubSpot
   */
  async getContactsFromHubSpot(tenantId: string): Promise<any[]> {
    try {
      const client = await this.hubspotClientFactory.getClient(tenantId);
      const response = await client.crm.contacts.getAll();
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      this.logger.error(`Failed to fetch contacts from HubSpot for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync contacts from HubSpot to tenant schema.
   * Fetches contacts in batches with pagination and rate limiting.
   */
  async syncContacts(tenantId: string): Promise<any[]> {
    // Create sync history record
    const syncHistory = await this.prisma.hubspotSyncHistory.create({
      data: {
        tenantId,
        syncType: 'manual',
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      // Ensure tenant schema has all required tables
      await this.schemaManager.ensureSchemaUpToDate(tenantId);

      const client = await this.hubspotClientFactory.getClient(tenantId);

      // 常用的 Contact 属性列表（避免获取所有属性导致 URL 过长）
      const commonProperties = [
        // 基本信息
        'firstname',
        'lastname',
        'email',
        'phone',
        'mobilephone',
        'company',
        'jobtitle',
        'website',
        // 地址信息
        'address',
        'city',
        'state',
        'zip',
        'country',
        // 生命周期和状态
        'lifecyclestage',
        'hs_lead_status',
        'hubspot_owner_id',
        // 时间戳
        'createdate',
        'lastmodifieddate',
        'notes_last_updated',
        // 关联信息
        'associatedcompanyid',
        'hs_email_domain',
        // 其他常用字段
        'industry',
        'numemployees',
        'annualrevenue',
        'hs_object_id',
        'jika_line_user_id',
      ];
      this.logger.log(`Using ${commonProperties.length} common contact properties`);

      // Fetch contacts with pagination to handle large datasets
      const PAGE_SIZE = 100; // HubSpot recommends 100 per page
      const allContacts: any[] = [];
      let after: string | undefined = undefined;
      let hasMore = true;

      // First, get total count estimate
      this.logger.log(`Starting contact sync for tenant ${tenantId}`);

      while (hasMore) {
        try {
          // Fetch page of contacts with common properties
          const response = await client.crm.contacts.basicApi.getPage(
            PAGE_SIZE,
            after,
            commonProperties, // 使用常用属性列表
            undefined, // propertiesWithHistory
            undefined, // associations
            false, // archived
          );
          
          allContacts.push(...response.results);
          
          // Update total after first page
          if (!after) {
            await this.prisma.hubspotSyncHistory.update({
              where: { id: syncHistory.id },
              data: {
                totalRecords: allContacts.length,
              },
            });
          }
          
          // Update progress
          await this.prisma.hubspotSyncHistory.update({
            where: { id: syncHistory.id },
            data: {
              processedRecords: allContacts.length,
            },
          });
          
          this.logger.debug(`Fetched ${allContacts.length} contacts so far...`);
          
          // Check if more pages exist
          after = response.paging?.next?.after;
          hasMore = !!after;
          
          // Rate limiting: wait 100ms between API calls to respect HubSpot limits
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          // Handle rate limiting (429 Too Many Requests)
          if (error.response?.status === 429 || error.code === 'RATE_LIMIT') {
            const retryAfter = error.response?.headers?.['retry-after'] || 5;
            this.logger.warn(`Rate limit hit, retrying after ${retryAfter} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            // Retry same page - don't increment 'after'
            continue;
          }
          
          this.logger.error(`Error fetching contacts page: ${error.message}`);
          throw error;
        }
      }
      
      this.logger.log(`Fetched ${allContacts.length} contacts from HubSpot for tenant ${tenantId}`);
      
      // Save to tenant database with progress tracking
      await this.saveContactsToDb(tenantId, allContacts, syncHistory.id);

      // Update sync history with success
      await this.prisma.hubspotSyncHistory.update({
        where: { id: syncHistory.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          processedRecords: allContacts.length,
          failedRecords: 0,
        },
      });
      
      return allContacts;
    } catch (error: any) {
      this.logger.error(`Failed to sync contacts for tenant ${tenantId}: ${error.message}`);
      
      // Update sync history with failure
      await this.prisma.hubspotSyncHistory.update({
        where: { id: syncHistory.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error?.message || 'Unknown error',
        },
      });
      
      throw error;
    }
  }

  /**
   * Save contacts to tenant schema database with batch processing and progress tracking
   * Uses Raw SQL for upsert operations
   */
  async saveContactsToDb(tenantId: string, contacts: any[], syncHistoryId?: string): Promise<void> {
    if (!contacts || contacts.length === 0) return;

    const BATCH_SIZE = 50; // 每批处理 50 条
    const PROGRESS_UPDATE_INTERVAL = 100;
    let processed = 0;

    // 分批处理
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      await this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
        for (const contact of batch) {
          const hubspotId = contact.id;
          const email = contact.properties.email || null;
          const firstname = contact.properties.firstname || null;
          const lastname = contact.properties.lastname || null;
          const properties = JSON.stringify(contact.properties);

          // Upsert using ON CONFLICT
          await tx.$executeRawUnsafe(`
            INSERT INTO hubspot_contacts (hubspot_id, email, firstname, lastname, properties, is_deleted, last_synced_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, false, NOW(), NOW(), NOW())
            ON CONFLICT (hubspot_id) 
            DO UPDATE SET 
              email = EXCLUDED.email,
              firstname = EXCLUDED.firstname,
              lastname = EXCLUDED.lastname,
              properties = EXCLUDED.properties,
              last_synced_at = NOW(),
              updated_at = NOW()
          `, hubspotId, email, firstname, lastname, properties);
        }
      });

      processed += batch.length;

      // 更新进度
      if (syncHistoryId && (processed % PROGRESS_UPDATE_INTERVAL === 0 || processed === contacts.length)) {
        try {
          await this.prisma.hubspotSyncHistory.update({
            where: { id: syncHistoryId },
            data: { processedRecords: processed },
          });
          this.logger.debug(`Saved ${processed}/${contacts.length} contacts`);
        } catch (err: any) {
          this.logger.warn(`Failed to update sync progress: ${err.message}`);
        }
      }
    }

    this.logger.log(`Saved ${contacts.length} contacts to tenant ${tenantId} schema`);
  }

  /**
   * Get contacts from tenant database with pagination and filtering
   * Uses raw SQL queries with explicit schema
   */
  async getContactsFromDb(
    tenantId: string,
    filters: ContactFiltersDto = {},
  ): Promise<PaginatedResponse<TenantHubspotContact>> {
    // Ensure tenant schema has all required tables
    await this.schemaManager.ensureSchemaUpToDate(tenantId);

    const safeTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const schemaName = `tenant_${safeTenantId}`;

    const { page = 1, limit = 20, search, sortBy = 'updatedAt', sortOrder = 'desc' } = filters;

    // Ensure page and limit are numbers
    const pageNum = Number(page);
    const limitNum = Math.min(Number(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    // 白名单验证排序字段 (map to actual column names)
    const ALLOWED_SORT_FIELDS: Record<string, string> = {
      id: 'id',
      email: 'email',
      firstname: 'firstname',
      lastname: 'lastname',
      created_at: 'created_at',
      updated_at: 'updated_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const sanitizedSortBy = ALLOWED_SORT_FIELDS[sortBy] || 'updated_at';
    const sanitizedSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build WHERE clause
    let whereClause = 'WHERE is_deleted = false';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (
        email ILIKE $${paramIndex} OR 
        firstname ILIKE $${paramIndex} OR 
        lastname ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Execute queries using raw SQL with explicit schema
    const [data, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<TenantHubspotContact[]>(
        `SELECT 
          id, 
          hubspot_id as "hubspotId", 
          email, 
          firstname, 
          lastname, 
          properties, 
          is_deleted as "isDeleted", 
          last_synced_at as "lastSyncedAt", 
          created_at as "createdAt", 
          updated_at as "updatedAt"
        FROM "${schemaName}"."hubspot_contacts"
        ${whereClause}
        ORDER BY "${sanitizedSortBy}" ${sanitizedSortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        ...params,
        limitNum,
        skip
      ),
      this.prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${schemaName}"."hubspot_contacts" ${whereClause}`,
        ...params
      ),
    ]);

    const total = Number(countResult[0]?.count || 0);

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  /**
   * Search contacts using Raw SQL
   */
  async searchContacts(tenantId: string, query: string): Promise<TenantHubspotContact[]> {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const searchPattern = `%${query}%`;
      return tx.$queryRaw<TenantHubspotContact[]>`
        SELECT 
          id, 
          hubspot_id as "hubspotId", 
          email, 
          firstname, 
          lastname, 
          properties, 
          is_deleted as "isDeleted", 
          last_synced_at as "lastSyncedAt", 
          created_at as "createdAt", 
          updated_at as "updatedAt"
        FROM hubspot_contacts
        WHERE is_deleted = false
          AND (
            email ILIKE ${searchPattern} OR 
            firstname ILIKE ${searchPattern} OR 
            lastname ILIKE ${searchPattern}
          )
        LIMIT 50
      `;
    });
  }

  /**
   * Get contact by HubSpot ID from tenant database using Raw SQL
   */
  async getContactByIdFromDb(tenantId: string, hubspotId: string): Promise<TenantHubspotContact | null> {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const results = await tx.$queryRaw<TenantHubspotContact[]>`
        SELECT 
          id, 
          hubspot_id as "hubspotId", 
          email, 
          firstname, 
          lastname, 
          properties, 
          is_deleted as "isDeleted", 
          last_synced_at as "lastSyncedAt", 
          created_at as "createdAt", 
          updated_at as "updatedAt"
        FROM hubspot_contacts
        WHERE hubspot_id = ${hubspotId} AND is_deleted = false
        LIMIT 1
      `;
      return results[0] || null;
    });
  }

  /**
   * Update contact in tenant database and sync to HubSpot using Raw SQL
   */
  async updateContactInDb(tenantId: string, hubspotId: string, updateData: any): Promise<TenantHubspotContact | null> {
    // Update in HubSpot first
    await this.updateContact(tenantId, hubspotId, updateData);

    // Then update in local database
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // 获取现有 contact 以合并 properties
      const existingContacts = await tx.$queryRaw<TenantHubspotContact[]>`
        SELECT 
          id, 
          hubspot_id as "hubspotId", 
          email, 
          firstname, 
          lastname, 
          properties, 
          is_deleted as "isDeleted", 
          last_synced_at as "lastSyncedAt", 
          created_at as "createdAt", 
          updated_at as "updatedAt"
        FROM hubspot_contacts
        WHERE hubspot_id = ${hubspotId}
        LIMIT 1
      `;

      const existingContact = existingContacts[0];

      // 构建更新字段
      const email = updateData.email !== undefined ? updateData.email : (existingContact?.email || null);
      const firstname = updateData.firstname !== undefined ? updateData.firstname : (existingContact?.firstname || null);
      const lastname = updateData.lastname !== undefined ? updateData.lastname : (existingContact?.lastname || null);

      // 合并 properties（其他字段存入 properties）
      const existingProperties = (existingContact?.properties as Record<string, any>) || {};
      const newProperties = { ...existingProperties };

      // 将非固定字段添加到 properties
      const propsToMerge = ['phone', 'company', 'jobtitle', 'lineUserId', 'lineDisplayName', 'lifecycleStage'];
      for (const prop of propsToMerge) {
        if (updateData[prop] !== undefined) {
          newProperties[prop] = updateData[prop];
        }
      }

      // 如果有 properties 更新，合并它
      if (updateData.properties) {
        Object.assign(newProperties, updateData.properties);
      }

      const propertiesJson = JSON.stringify(newProperties);

      await tx.$executeRaw`
        UPDATE hubspot_contacts
        SET email = ${email},
            firstname = ${firstname},
            lastname = ${lastname},
            properties = ${propertiesJson}::jsonb,
            updated_at = NOW()
        WHERE hubspot_id = ${hubspotId}
      `;

      return this.getContactByIdFromDb(tenantId, hubspotId);
    });
  }

  /**
   * Delete contact (soft delete) using Raw SQL
   */
  async deleteContactFromDb(tenantId: string, hubspotId: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      await tx.$executeRaw`
        UPDATE hubspot_contacts
        SET is_deleted = true, updated_at = NOW()
        WHERE hubspot_id = ${hubspotId}
      `;
    });
  }

  /**
   * Trigger full sync job
   */
  async triggerFullSync(tenantId: string): Promise<SyncResult> {
    // Create sync history record
    const syncHistory = await this.prisma.hubspotSyncHistory.create({
      data: {
        tenantId,
        syncType: 'full',
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Queue sync job
    await this.hubspotSyncQueue.add('fullContactSync', {
      tenantId,
      syncHistoryId: syncHistory.id,
    });

    return {
      success: true,
      syncHistoryId: syncHistory.id,
      totalRecords: 0,
      processedRecords: 0,
      failedRecords: 0,
      message: 'Full sync initiated',
    };
  }

  /**
   * Get sync history
   */
  async getSyncHistory(tenantId: string, limit: number = 10): Promise<any[]> {
    return await this.prisma.hubspotSyncHistory.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get latest sync status
   */
  async getSyncStatus(tenantId: string, syncType?: string): Promise<any> {
    const where: any = { tenantId };
    if (syncType) {
      where.syncType = syncType;
    }

    const latestSync = await this.prisma.hubspotSyncHistory.findFirst({
      where,
      orderBy: { startedAt: 'desc' },
    });

    return latestSync || null;
  }

  /**
   * Sync companies from HubSpot with pagination, rate limiting, and progress tracking
   */
  async syncCompanies(tenantId: string): Promise<any[]> {
    await this.schemaManager.ensureSchemaUpToDate(tenantId);
    
    // Create sync history record
    const syncHistory = await this.prisma.hubspotSyncHistory.create({
      data: {
        tenantId,
        syncType: 'companies',
        status: 'running',
        startedAt: new Date(),
        totalRecords: 0,
        processedRecords: 0,
      },
    });

    try {
      const client = await this.hubspotClientFactory.getClient(tenantId);

      // 常用的 Company 属性列表（避免获取所有属性导致 URL 过长）
      const commonCompanyProperties = [
        // 基本信息
        'name',
        'domain',
        'website',
        'phone',
        'industry',
        'description',
        'type',
        // 地址信息
        'address',
        'address2',
        'city',
        'state',
        'zip',
        'country',
        // 公司规模和收入
        'numberofemployees',
        'annualrevenue',
        // 生命周期和状态
        'lifecyclestage',
        'hs_lead_status',
        'hubspot_owner_id',
        // 时间戳
        'createdate',
        'hs_lastmodifieddate',
        'notes_last_updated',
        // 其他常用字段
        'hs_object_id',
        'founded_year',
        'linkedin_company_page',
        'facebook_company_page',
        'twitterhandle',
      ];
      this.logger.log(`Using ${commonCompanyProperties.length} common company properties`);

      const PAGE_SIZE = 100; // HubSpot recommended page size
      const allCompanies: any[] = [];
      let after: string | undefined;
      let hasMore = true;

      // Fetch companies with pagination
      while (hasMore) {
        try {
          // Fetch page of companies with common properties
          const response = await client.crm.companies.basicApi.getPage(
            PAGE_SIZE,
            after,
            commonCompanyProperties, // 使用常用属性列表
            undefined, // propertiesWithHistory
            undefined, // associations
            false, // archived
          );
          
          allCompanies.push(...response.results);
          
          // Update total after first page
          if (!after) {
            await this.prisma.hubspotSyncHistory.update({
              where: { id: syncHistory.id },
              data: {
                totalRecords: allCompanies.length,
              },
            });
          }
          
          // Update progress
          await this.prisma.hubspotSyncHistory.update({
            where: { id: syncHistory.id },
            data: {
              processedRecords: allCompanies.length,
            },
          });
          
          this.logger.debug(`Fetched ${allCompanies.length} companies so far...`);
          
          // Check if more pages exist
          after = response.paging?.next?.after;
          hasMore = !!after;
          
          // Rate limiting: wait 100ms between API calls to respect HubSpot limits
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          // Handle rate limiting (429 Too Many Requests)
          if (error.response?.status === 429 || error.code === 'RATE_LIMIT') {
            const retryAfter = error.response?.headers?.['retry-after'] || 5;
            this.logger.warn(`Rate limit hit, retrying after ${retryAfter} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            // Retry same page - don't increment 'after'
            continue;
          }
          
          this.logger.error(`Error fetching companies page: ${error.message}`);
          throw error;
        }
      }
      
      this.logger.log(`Fetched ${allCompanies.length} companies from HubSpot for tenant ${tenantId}`);
      
      // Save to tenant database with progress tracking
      await this.saveCompaniesToDb(tenantId, allCompanies, syncHistory.id);

      // Update sync history with success
      await this.prisma.hubspotSyncHistory.update({
        where: { id: syncHistory.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          processedRecords: allCompanies.length,
          totalRecords: allCompanies.length,
        },
      });

      return allCompanies;
    } catch (error: any) {
      this.logger.error(`Failed to sync companies for tenant ${tenantId}: ${error.message}`);
      
      // Update sync history with failure
      await this.prisma.hubspotSyncHistory.update({
        where: { id: syncHistory.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error?.message || 'Unknown error',
        },
      });
      
      throw error;
    }
  }

  /**
   * Save companies to tenant schema database with batch processing and progress tracking
   * Uses Raw SQL for upsert operations
   */
  async saveCompaniesToDb(tenantId: string, companies: any[], syncHistoryId?: string): Promise<void> {
    if (!companies || companies.length === 0) return;

    const BATCH_SIZE = 50; // 每批处理 50 条
    const PROGRESS_UPDATE_INTERVAL = 100;
    let processed = 0;

    // 分批处理
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);

      await this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
        for (const company of batch) {
          const hubspotId = company.id;
          const name = company.properties.name || null;
          const domain = company.properties.domain || null;
          const properties = JSON.stringify(company.properties);

          // Upsert using ON CONFLICT
          await tx.$executeRawUnsafe(`
            INSERT INTO hubspot_companies (hubspot_id, name, domain, properties, is_deleted, last_synced_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, false, NOW(), NOW(), NOW())
            ON CONFLICT (hubspot_id) 
            DO UPDATE SET 
              name = EXCLUDED.name,
              domain = EXCLUDED.domain,
              properties = EXCLUDED.properties,
              last_synced_at = NOW(),
              updated_at = NOW()
          `, hubspotId, name, domain, properties);
        }
      });

      processed += batch.length;

      // 更新进度
      if (syncHistoryId && (processed % PROGRESS_UPDATE_INTERVAL === 0 || processed === companies.length)) {
        try {
          await this.prisma.hubspotSyncHistory.update({
            where: { id: syncHistoryId },
            data: { processedRecords: processed },
          });
          this.logger.debug(`Saved ${processed}/${companies.length} companies`);
        } catch (err: any) {
          this.logger.warn(`Failed to update sync progress: ${err.message}`);
        }
      }
    }

    this.logger.log(`Saved ${companies.length} companies to tenant ${tenantId} schema`);
  }

  /**
   * Get companies from tenant database with pagination and filtering using Raw SQL
   */
  async getCompaniesFromDb(
    tenantId: string,
    filters: { search?: string; industry?: string; page?: number; pageSize?: number },
  ): Promise<PaginatedResponse<TenantHubspotCompany>> {
    await this.schemaManager.ensureSchemaUpToDate(tenantId);

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const page = Math.max(1, filters.page || 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize || 25));
      const skip = (page - 1) * pageSize;

      // Build queries based on search
      let data: TenantHubspotCompany[];
      let countResult: [{ count: bigint }];

      if (filters.search) {
        const searchPattern = `%${filters.search}%`;
        [data, countResult] = await Promise.all([
          tx.$queryRaw<TenantHubspotCompany[]>`
            SELECT 
              id, 
              hubspot_id as "hubspotId", 
              name, 
              domain, 
              properties, 
              is_deleted as "isDeleted", 
              last_synced_at as "lastSyncedAt", 
              created_at as "createdAt", 
              updated_at as "updatedAt"
            FROM hubspot_companies
            WHERE is_deleted = false
              AND (name ILIKE ${searchPattern} OR domain ILIKE ${searchPattern})
            ORDER BY name ASC
            LIMIT ${pageSize} OFFSET ${skip}
          `,
          tx.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM hubspot_companies
            WHERE is_deleted = false
              AND (name ILIKE ${searchPattern} OR domain ILIKE ${searchPattern})
          `,
        ]);
      } else {
        [data, countResult] = await Promise.all([
          tx.$queryRaw<TenantHubspotCompany[]>`
            SELECT 
              id, 
              hubspot_id as "hubspotId", 
              name, 
              domain, 
              properties, 
              is_deleted as "isDeleted", 
              last_synced_at as "lastSyncedAt", 
              created_at as "createdAt", 
              updated_at as "updatedAt"
            FROM hubspot_companies
            WHERE is_deleted = false
            ORDER BY name ASC
            LIMIT ${pageSize} OFFSET ${skip}
          `,
          tx.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM hubspot_companies
            WHERE is_deleted = false
          `,
        ]);
      }

      const total = Number(countResult[0]?.count || 0);

      return {
        data,
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  /**
   * Get company by ID from tenant database using Raw SQL
   */
  async getCompanyByIdFromDb(tenantId: string, id: string): Promise<TenantHubspotCompany | null> {
    await this.schemaManager.ensureSchemaUpToDate(tenantId);

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const idNum = parseInt(id);
      const results = await tx.$queryRaw<TenantHubspotCompany[]>`
        SELECT 
          id, 
          hubspot_id as "hubspotId", 
          name, 
          domain, 
          properties, 
          is_deleted as "isDeleted", 
          last_synced_at as "lastSyncedAt", 
          created_at as "createdAt", 
          updated_at as "updatedAt"
        FROM hubspot_companies
        WHERE id = ${idNum} AND is_deleted = false
        LIMIT 1
      `;
      return results[0] || null;
    });
  }
}
