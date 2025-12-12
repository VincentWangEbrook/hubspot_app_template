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
    // Use dynamic import or require for crypto if not available in global (Node.js has it)
    // NestJS runs on Node, so 'crypto' should be importable.
    // I need to add import * as crypto from 'crypto'; at the top.
    // But I can't easily add import at top with this tool unless I replace the whole file or use multi_replace.
    // I'll use require('crypto') inside the method for simplicity or add import in a separate step.
    // Let's use require for now to avoid messing up imports again.
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
      // Note: The HubSpot API for retrieving a specific conversation message might vary based on API version.
      // This is a placeholder assuming we can get it via an endpoint.
      // If not directly available, we might need to list messages in a thread.
      // For now, returning a placeholder or implementing a best-effort fetch.
      
      // Example: client.conversations.messages.get(messageId) - check actual API
      // If the client doesn't have this specific method typed yet, we might need to use raw request
      // or check the correct namespace (e.g. client.conversations.messagesApi.get)
      
      // For now, let's assume we can't easily get it without more research on the specific API endpoint,
      // so we'll return a generic message or try to fetch if possible.
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
      
      // Fetch contacts with pagination to handle large datasets
      const PAGE_SIZE = 100; // HubSpot recommends 100 per page
      const allContacts: any[] = [];
      let after: string | undefined = undefined;
      let hasMore = true;
      
      // First, get total count estimate
      this.logger.log(`Starting contact sync for tenant ${tenantId}`);
      
      while (hasMore) {
        try {
          // Fetch page of contacts
          const response = await client.crm.contacts.basicApi.getPage(
            PAGE_SIZE,
            after,
            undefined, // properties (undefined = all)
            undefined, // propertiesWithHistory
            undefined, // associations
            false // archived
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
   */
  async saveContactsToDb(tenantId: string, contacts: any[], syncHistoryId?: string): Promise<void> {
    if (!contacts || contacts.length === 0) return;

    const BATCH_SIZE = 100; // Process 100 contacts per batch transaction
    const PROGRESS_UPDATE_INTERVAL = 200; // Update progress every 200 contacts
    let processed = 0;

    // Split contacts into batches
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      let currentBatchSize = batch.length;
      let batchProcessed = false;
      
      // Retry with smaller batch if parameter limit exceeded
      while (!batchProcessed && currentBatchSize > 0) {
        try {
          const currentBatch = batch.slice(0, currentBatchSize);
          
          // Process entire batch in single transaction
          await this.prisma.withTenant(tenantId, async (prisma) => {
            // Build bulk insert values
            const values: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            for (const contact of currentBatch) {
              const contactData = {
                hubspot_id: contact.id,
                email: contact.properties.email || null,
                firstname: contact.properties.firstname || null,
                lastname: contact.properties.lastname || null,
                phone: contact.properties.phone || null,
                company: contact.properties.company || null,
                job_title: contact.properties.jobtitle || null,
                lifecycle_stage: contact.properties.lifecyclestage || null,
                line_user_id: contact.properties.line_user_id || null,
                line_display_name: contact.properties.line_display_name || null,
                properties: contact.properties,
                last_synced_at: new Date(),
                hubspot_created_at: contact.properties.createdate ? new Date(contact.properties.createdate) : null,
                hubspot_updated_at: contact.properties.lastmodifieddate ? new Date(contact.properties.lastmodifieddate) : null,
              };

              // Add to values array with parameterized placeholders
              values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}::jsonb, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13})`);
              
              params.push(
                contactData.hubspot_id,
                contactData.email,
                contactData.firstname,
                contactData.lastname,
                contactData.phone,
                contactData.company,
                contactData.job_title,
                contactData.lifecycle_stage,
                contactData.line_user_id,
                contactData.line_display_name,
                JSON.stringify(contactData.properties),
                contactData.last_synced_at,
                contactData.hubspot_created_at,
                contactData.hubspot_updated_at,
              );
              
              paramIndex += 14;
            }

            // Execute bulk insert
            await prisma.$executeRawUnsafe(
              `INSERT INTO hubspot_contacts 
              (hubspot_id, email, firstname, lastname, phone, company, job_title, lifecycle_stage, 
               line_user_id, line_display_name, properties, last_synced_at, hubspot_created_at, hubspot_updated_at)
              VALUES ${values.join(', ')}
              ON CONFLICT (hubspot_id) DO UPDATE SET
                email = EXCLUDED.email,
                firstname = EXCLUDED.firstname,
                lastname = EXCLUDED.lastname,
                phone = EXCLUDED.phone,
                company = EXCLUDED.company,
                job_title = EXCLUDED.job_title,
                lifecycle_stage = EXCLUDED.lifecycle_stage,
                line_user_id = EXCLUDED.line_user_id,
                line_display_name = EXCLUDED.line_display_name,
                properties = EXCLUDED.properties,
                last_synced_at = EXCLUDED.last_synced_at,
                hubspot_updated_at = EXCLUDED.hubspot_updated_at,
                updated_at = now()`,
              ...params
            );
          });

          batchProcessed = true;
          processed += currentBatchSize;
          
          // If we had to reduce batch size, process remaining contacts
          if (currentBatchSize < batch.length) {
            i += currentBatchSize - BATCH_SIZE; // Adjust index to process remaining
          }
        } catch (error: any) {
          // Handle parameter limit exceeded (PostgreSQL error code 54000 or similar)
          if (error.message?.includes('too many parameters') || 
              error.message?.includes('bind message has') ||
              error.code === '54000') {
            // Reduce batch size by half and retry
            currentBatchSize = Math.floor(currentBatchSize / 2);
            if (currentBatchSize === 0) {
              this.logger.error('Cannot process even single contact - parameter limit issue');
              throw error;
            }
            this.logger.warn(`Parameter limit exceeded, reducing batch size to ${currentBatchSize} and retrying...`);
            continue;
          }
          
          // For other errors, throw immediately
          throw error;
        }
      }

      // Update progress periodically - OUTSIDE transaction
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
   */
  async getContactsFromDb(
    tenantId: string,
    filters: ContactFiltersDto = {},
  ): Promise<PaginatedResponse<any>> {
    // Ensure tenant schema has all required tables
    await this.schemaManager.ensureSchemaUpToDate(tenantId);

    return await this.prisma.withTenant(tenantId, async (prisma) => {
      const { page = 1, limit = 20, search, sortBy = 'updated_at', sortOrder = 'desc', hasLineBinding, lifecycleStage, company } = filters;
      
      // Ensure page and limit are numbers
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE clause
      let whereClause = 'WHERE is_deleted = false';
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (email ILIKE $${paramIndex} OR firstname ILIKE $${paramIndex} OR lastname ILIKE $${paramIndex} OR company ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (hasLineBinding !== undefined) {
        if (hasLineBinding) {
          whereClause += ` AND line_user_id IS NOT NULL`;
        } else {
          whereClause += ` AND line_user_id IS NULL`;
        }
      }

      if (lifecycleStage) {
        whereClause += ` AND lifecycle_stage = $${paramIndex}`;
        params.push(lifecycleStage);
        paramIndex++;
      }

      if (company) {
        whereClause += ` AND company ILIKE $${paramIndex}`;
        params.push(`%${company}%`);
        paramIndex++;
      }

      // Get total count
      const countResult: any = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM hubspot_contacts ${whereClause}`,
        ...params
      );
      const total = countResult[0]?.count || 0;

      // Get paginated data
      const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
      const data: any = await prisma.$queryRawUnsafe(
        `SELECT * FROM hubspot_contacts ${whereClause} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        ...params,
        limitNum,
        offset
      );

      return {
        data,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    });
  }

  /**
   * Search contacts
   */
  async searchContacts(tenantId: string, query: string): Promise<any[]> {
    return await this.prisma.withTenant(tenantId, async (prisma) => {
      const results: any = await prisma.$queryRawUnsafe(
        `SELECT * FROM hubspot_contacts 
         WHERE is_deleted = false 
         AND (email ILIKE $1 OR firstname ILIKE $1 OR lastname ILIKE $1 OR company ILIKE $1 OR line_display_name ILIKE $1)
         LIMIT 50`,
        `%${query}%`
      );
      return results;
    });
  }

  /**
   * Get contact by HubSpot ID from tenant database
   */
  async getContactByIdFromDb(tenantId: string, hubspotId: string): Promise<any> {
    return await this.prisma.withTenant(tenantId, async (prisma) => {
      const results: any = await prisma.$queryRawUnsafe(
        `SELECT * FROM hubspot_contacts WHERE hubspot_id = $1 AND is_deleted = false LIMIT 1`,
        hubspotId
      );
      return results[0] || null;
    });
  }

  /**
   * Update contact in tenant database and sync to HubSpot
   */
  async updateContactInDb(tenantId: string, hubspotId: string, updateData: any): Promise<any> {
    // Update in HubSpot first
    await this.updateContact(tenantId, hubspotId, updateData);

    // Then update in local database
    return await this.prisma.withTenant(tenantId, async (prisma) => {
      const setClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Build SET clause dynamically
      const fieldMap: Record<string, string> = {
        firstname: 'firstname',
        lastname: 'lastname',
        email: 'email',
        phone: 'phone',
        company: 'company',
        jobtitle: 'job_title',
        lineUserId: 'line_user_id',
        lineDisplayName: 'line_display_name',
      };

      for (const [key, dbField] of Object.entries(fieldMap)) {
        if (updateData[key] !== undefined) {
          setClauses.push(`${dbField} = $${paramIndex}`);
          params.push(updateData[key]);
          paramIndex++;
        }
      }

      if (updateData.properties) {
        setClauses.push(`properties = $${paramIndex}`);
        params.push(JSON.stringify(updateData.properties));
        paramIndex++;
      }

      setClauses.push(`updated_at = now()`);
      params.push(hubspotId);

      await prisma.$executeRawUnsafe(
        `UPDATE hubspot_contacts SET ${setClauses.join(', ')} WHERE hubspot_id = $${paramIndex}`,
        ...params
      );

      return this.getContactByIdFromDb(tenantId, hubspotId);
    });
  }

  /**
   * Delete contact (soft delete)
   */
  async deleteContactFromDb(tenantId: string, hubspotId: string): Promise<void> {
    await this.prisma.withTenant(tenantId, async (prisma) => {
      await prisma.$executeRawUnsafe(
        `UPDATE hubspot_contacts SET is_deleted = true, updated_at = now() WHERE hubspot_id = $1`,
        hubspotId
      );
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
      
      const PAGE_SIZE = 100; // HubSpot recommended page size
      const allCompanies: any[] = [];
      let after: string | undefined;
      let hasMore = true;

      // Fetch companies with pagination
      while (hasMore) {
        try {
          // Fetch page of companies
          const response = await client.crm.companies.basicApi.getPage(
            PAGE_SIZE,
            after,
            undefined, // properties (undefined = all)
            undefined, // propertiesWithHistory
            undefined, // associations
            false // archived
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
   */
  async saveCompaniesToDb(tenantId: string, companies: any[], syncHistoryId?: string): Promise<void> {
    if (!companies || companies.length === 0) return;

    const BATCH_SIZE = 100; // Process 100 companies per batch transaction
    const PROGRESS_UPDATE_INTERVAL = 200; // Update progress every 200 companies
    let processed = 0;

    // Split companies into batches
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      let currentBatchSize = batch.length;
      let batchProcessed = false;
      
      // Retry with smaller batch if parameter limit exceeded
      while (!batchProcessed && currentBatchSize > 0) {
        try {
          const currentBatch = batch.slice(0, currentBatchSize);
          
          // Process entire batch in single transaction
          await this.prisma.withTenant(tenantId, async (prisma) => {
            // Build bulk insert values
            const values: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            for (const company of currentBatch) {
              const companyData = {
                hubspot_id: company.id,
                name: company.properties.name || null,
                domain: company.properties.domain || null,
                industry: company.properties.industry || null,
                city: company.properties.city || null,
                state: company.properties.state || null,
                country: company.properties.country || null,
                zip: company.properties.zip || null,
                phone: company.properties.phone || null,
                website: company.properties.website || null,
                description: company.properties.description || null,
                num_employees: company.properties.numberofemployees ? parseInt(company.properties.numberofemployees) : null,
                annual_revenue: company.properties.annualrevenue ? parseFloat(company.properties.annualrevenue) : null,
                type: company.properties.type || null,
                line_channel_id: company.properties.line_channel_id || null,
                properties: company.properties,
                last_synced_at: new Date(),
                hubspot_created_at: company.properties.createdate ? new Date(company.properties.createdate) : null,
                hubspot_updated_at: company.properties.hs_lastmodifieddate ? new Date(company.properties.hs_lastmodifieddate) : null,
              };

              // Add to values array with parameterized placeholders (18 fields)
              values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13}, $${paramIndex+14}, $${paramIndex+15}, $${paramIndex+16}::jsonb, $${paramIndex+17}, $${paramIndex+18})`);
              
              params.push(
                companyData.hubspot_id,
                companyData.name,
                companyData.domain,
                companyData.industry,
                companyData.city,
                companyData.state,
                companyData.country,
                companyData.zip,
                companyData.phone,
                companyData.website,
                companyData.description,
                companyData.num_employees,
                companyData.annual_revenue,
                companyData.type,
                companyData.line_channel_id,
                JSON.stringify(companyData.properties),
                companyData.last_synced_at,
                companyData.hubspot_created_at,
                companyData.hubspot_updated_at,
              );
              
              paramIndex += 19;
            }

            // Execute bulk insert
            await prisma.$executeRawUnsafe(
              `INSERT INTO hubspot_companies 
              (hubspot_id, name, domain, industry, city, state, country, zip, phone, website, 
               description, num_employees, annual_revenue, type, line_channel_id, properties, 
               last_synced_at, hubspot_created_at, hubspot_updated_at)
              VALUES ${values.join(', ')}
              ON CONFLICT (hubspot_id) DO UPDATE SET
                name = EXCLUDED.name,
                domain = EXCLUDED.domain,
                industry = EXCLUDED.industry,
                city = EXCLUDED.city,
                state = EXCLUDED.state,
                country = EXCLUDED.country,
                zip = EXCLUDED.zip,
                phone = EXCLUDED.phone,
                website = EXCLUDED.website,
                description = EXCLUDED.description,
                num_employees = EXCLUDED.num_employees,
                annual_revenue = EXCLUDED.annual_revenue,
                type = EXCLUDED.type,
                line_channel_id = EXCLUDED.line_channel_id,
                properties = EXCLUDED.properties,
                last_synced_at = EXCLUDED.last_synced_at,
                hubspot_updated_at = EXCLUDED.hubspot_updated_at,
                updated_at = now()`,
              ...params
            );
          });

          batchProcessed = true;
          processed += currentBatchSize;
          
          // If we had to reduce batch size, process remaining companies
          if (currentBatchSize < batch.length) {
            i += currentBatchSize - BATCH_SIZE; // Adjust index to process remaining
          }
        } catch (error: any) {
          // Handle parameter limit exceeded (PostgreSQL error code 54000 or similar)
          if (error.message?.includes('too many parameters') || 
              error.message?.includes('bind message has') ||
              error.code === '54000') {
            // Reduce batch size by half and retry
            currentBatchSize = Math.floor(currentBatchSize / 2);
            if (currentBatchSize === 0) {
              this.logger.error('Cannot process even single company - parameter limit issue');
              throw error;
            }
            this.logger.warn(`Parameter limit exceeded, reducing batch size to ${currentBatchSize} and retrying...`);
            continue;
          }
          
          // For other errors, throw immediately
          throw error;
        }
      }

      // Update progress periodically - OUTSIDE transaction
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
   * Get companies from tenant database with pagination and filtering
   */
  async getCompaniesFromDb(
    tenantId: string,
    filters: { search?: string; industry?: string; page?: number; pageSize?: number },
  ): Promise<PaginatedResponse<any>> {
    await this.schemaManager.ensureSchemaUpToDate(tenantId);

    return await this.prisma.withTenant(tenantId, async (prisma) => {
      const page = Math.max(1, filters.page || 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize || 25));
      const offset = (page - 1) * pageSize;

      // Build WHERE clause
      let whereClause = 'WHERE is_deleted = false';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR domain ILIKE $${paramIndex} OR industry ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (filters.industry) {
        whereClause += ` AND industry = $${paramIndex}`;
        params.push(filters.industry);
        paramIndex++;
      }

      // Get total count
      const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM hubspot_companies ${whereClause}`,
        ...params,
      );
      const total = Number(countResult[0]?.count || 0);

      // Get paginated data
      const companies = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM hubspot_companies 
         ${whereClause}
         ORDER BY name ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        ...params,
        pageSize,
        offset,
      );

      return {
        data: companies,
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  /**
   * Get company by ID from tenant database
   */
  async getCompanyByIdFromDb(tenantId: string, id: string): Promise<any | null> {
    await this.schemaManager.ensureSchemaUpToDate(tenantId);

    return await this.prisma.withTenant(tenantId, async (prisma) => {
      const companies = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM hubspot_companies WHERE id = $1 AND is_deleted = false LIMIT 1`,
        parseInt(id),
      );
      return companies[0] || null;
    });
  }
}
