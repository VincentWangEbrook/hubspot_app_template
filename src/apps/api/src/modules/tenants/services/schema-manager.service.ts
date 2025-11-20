import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchemaManagerService {
  private readonly logger = new Logger(SchemaManagerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTenantSchema(tenantId: string) {
    // Sanitize tenantId
    const safeTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const schemaName = `tenant_${safeTenantId}`;

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Create Schema
        await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

        // 2. Create Tables
        // Channels
        await tx.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schemaName}"."channels" (
            "id" SERIAL NOT NULL,
            "tenantId" character varying NOT NULL,
            "channelType" character varying NOT NULL,
            "externalUserId" character varying NOT NULL,
            "hubspotContactId" character varying NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_channels_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_channels_tenant_type_user" UNIQUE ("tenantId", "channelType", "externalUserId")
          )
        `);

        // Messages
        await tx.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schemaName}"."messages" (
            "id" SERIAL NOT NULL,
            "channel_id" integer,
            "tenantId" character varying NOT NULL,
            "content" text NOT NULL,
            "isFromUser" boolean NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
            CONSTRAINT "FK_messages_channel_id" FOREIGN KEY ("channel_id") REFERENCES "${schemaName}"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE
          )
        `);

        // HubSpot Conversations
        await tx.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schemaName}"."hubspot_conversations" (
            "id" SERIAL NOT NULL,
            "tenantId" character varying NOT NULL,
            "hubspotContactId" character varying NOT NULL,
            "conversationId" character varying NOT NULL,
            "channel_id" integer,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_hubspot_conversations_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_hubspot_conversations_tenant_contact_channel" UNIQUE ("tenantId", "hubspotContactId", "channel_id"),
            CONSTRAINT "FK_hubspot_conversations_channel_id" FOREIGN KEY ("channel_id") REFERENCES "${schemaName}"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE
          )
        `);
      });

      this.logger.log(`Schema ${schemaName} created/verified successfully.`);
    } catch (err) {
      this.logger.error(`Failed to create schema ${schemaName}`, err);
      throw err;
    }
  }
}
