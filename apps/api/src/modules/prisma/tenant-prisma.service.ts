/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Channel 数据类型
 */
export interface TenantChannel {
  id: number;
  tenantId: string;
  channelType: string;
  externalUserId: string;
  hubspotContactId: string;
  contactName: string | null;
  contactAvatar: string | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message 数据类型
 */
export interface TenantMessage {
  id: number;
  channelId: number;
  tenantId: string;
  content: string;
  isFromUser: boolean;
  messageType: string;
  senderId: string | null;
  externalId: string | null;
  status: string;
  metadata: any;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * ChannelConfig 数据类型
 */
export interface TenantChannelConfig {
  id: string;
  tenantId: string;
  channelType: string;
  credentials: string;
  isActive: boolean;
  webhookUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * HubspotConversation 数据类型
 */
export interface TenantHubspotConversation {
  id: number;
  tenantId: string;
  hubspotContactId: string;
  conversationId: string;
  channelId: number;
  createdAt: Date;
}

/**
 * HubspotContact 数据类型
 */
export interface TenantHubspotContact {
  id: number;
  hubspotId: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  properties: any;
  isDeleted: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * HubspotCompany 数据类型
 */
export interface TenantHubspotCompany {
  id: number;
  hubspotId: string;
  name: string | null;
  domain: string | null;
  properties: any;
  isDeleted: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transaction client with raw query methods
 */
export interface TenantTransactionClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute a callback within a tenant-specific schema context using a transaction.
   * This ensures that 'SET search_path' applies to all queries within the callback.
   * Now returns a TenantTransactionClient that only supports raw SQL queries.
   */
  async runInTenantContext<T>(
    tenantId: string,
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    // Sanitize tenantId to prevent SQL injection (though uuid is safe, good practice)
    const schemaName = `tenant_${tenantId.replace(/[^a-zA-Z0-9-]/g, '')}`;
    
    return this.prisma.$transaction(async (tx) => {
      // Set the search path for this transaction
      await tx.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);
      
      // Return a limited client that only exposes raw query methods
      const tenantTx: TenantTransactionClient = {
        $queryRaw: <T>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => 
          tx.$queryRaw<T>(query as any, ...values),
        $executeRaw: (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => 
          tx.$executeRaw(query as any, ...values),
        $queryRawUnsafe: <T>(query: string, ...values: unknown[]) => 
          tx.$queryRawUnsafe<T>(query, ...values),
        $executeRawUnsafe: (query: string, ...values: unknown[]) => 
          tx.$executeRawUnsafe(query, ...values),
      };
      
      return callback(tenantTx);
    });
  }

  /**
   * Get the schema name for a tenant
   */
  getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/[^a-zA-Z0-9-]/g, '')}`;
  }
}
