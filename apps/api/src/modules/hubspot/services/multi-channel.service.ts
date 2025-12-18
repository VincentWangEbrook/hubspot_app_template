/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable } from '@nestjs/common';
import { TenantPrismaService, TenantChannel, TenantHubspotConversation } from '../../prisma/tenant-prisma.service';
import { HubspotClientFactory } from './hubspot-client.factory';
import { AssociationSpecAssociationCategoryEnum } from '@hubspot/api-client/lib/codegen/crm/contacts';

@Injectable()
export class MultiChannelService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly hubspotClientFactory: HubspotClientFactory,
  ) {}

  // 保存用户消息到 DB（入库）
  async saveIncomingMessage(
    tenantId: string,
    params: { channelType: string; externalUserId: string; content: string },
  ) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const { channelType, externalUserId, content } = params;
      
      const channels = await tx.$queryRaw<TenantChannel[]>`
        SELECT 
          id,
          tenant_id as "tenantId",
          channel_type as "channelType",
          external_user_id as "externalUserId",
          hubspot_contact_id as "hubspotContactId",
          contact_name as "contactName",
          contact_avatar as "contactAvatar",
          unread_count as "unreadCount",
          last_message_at as "lastMessageAt",
          status,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM channels
        WHERE tenant_id = ${tenantId}::uuid 
          AND channel_type = ${channelType} 
          AND external_user_id = ${externalUserId}
        LIMIT 1
      `;

      const channel = channels[0];

      if (!channel) throw new Error(`Channel not bound for tenant=${tenantId} user=${externalUserId}`);

      await tx.$executeRaw`
        INSERT INTO messages (channel_id, tenant_id, content, is_from_user, created_at)
        VALUES (${channel.id}, ${tenantId}::uuid, ${content}, true, NOW())
      `;

      return channel;
    });
  }

  // 保存 outgoing (HubSpot->channel) 到 DB
  async saveOutgoingMessage(
    tenantId: string,
    params: { channel: TenantChannel; content: string },
  ) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const result = await tx.$queryRaw<{ id: number }[]>`
        INSERT INTO messages (channel_id, tenant_id, content, is_from_user, created_at)
        VALUES (${params.channel.id}, ${tenantId}::uuid, ${params.content}, false, NOW())
        RETURNING id
      `;
      return result[0];
    });
  }

  // 确保 HubSpot Contact 存在
  async ensureHubspotContact(tenantId: string, channel: TenantChannel) {
    if (channel.hubspotContactId) return channel.hubspotContactId;
    throw new Error('Channel missing hubspotContactId - create mapping first');
  }

  // 确保 conversation mapping 存在（关系查询）
  async ensureHubspotConversation(tenantId: string, channel: TenantChannel) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const existing = await tx.$queryRaw<TenantHubspotConversation[]>`
        SELECT 
          id,
          tenant_id as "tenantId",
          hubspot_contact_id as "hubspotContactId",
          conversation_id as "conversationId",
          channel_id as "channelId",
          created_at as "createdAt"
        FROM hubspot_conversations
        WHERE tenant_id = ${tenantId}::uuid
          AND hubspot_contact_id = ${channel.hubspotContactId}
          AND channel_id = ${channel.id}
        LIMIT 1
      `;
      
      if (existing.length > 0) return existing[0].conversationId;

      const client = await this.hubspotClientFactory.getClient(tenantId);
      const created = await client.crm.objects.basicApi.create('conversations', {
        properties: {
          hs_thread_subject: `${channel.channelType} Chat (${channel.hubspotContactId})`,
          hs_channel_type: 'CUSTOM',
          hs_channel_source: channel.channelType,
        },
      });

      await tx.$executeRaw`
        INSERT INTO hubspot_conversations (tenant_id, hubspot_contact_id, channel_id, conversation_id, created_at)
        VALUES (${tenantId}::uuid, ${channel.hubspotContactId}, ${channel.id}, ${created.id}, NOW())
      `;

      return created.id;
    });
  }

  // 把消息发送到 HubSpot conversation_messages
  async sendMessageToHubspot(tenantId: string, channel: TenantChannel, content: string, senderType: 'CONTACT'|'USER'='CONTACT') {
    const client = await this.hubspotClientFactory.getClient(tenantId);
    const convId = await this.ensureHubspotConversation(tenantId, channel);

    await client.crm.objects.basicApi.create('conversation_messages', {
      properties: {
        hs_body: content,
        hs_sender_id: channel.hubspotContactId,
        hs_sender_type: senderType,
        hs_channel_type: 'CUSTOM',
        hs_channel_source: channel.channelType,
      },
      associations: [
        { 
          to: { id: convId },
          types: [{
            associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined,
            associationTypeId: 9 
          }]
        }
      ],
    });

    return convId;
  }

  // 供 HubSpot->Line 读取 HubSpot 消息详情
  async getHubspotMessageById(tenantId: string, messageId: string) {
    const client = await this.hubspotClientFactory.getClient(tenantId);
  
    const msg = await client.crm.objects.basicApi.getById(
      'conversation_messages',
      messageId,
      ['hs_body', 'hs_sender_id', 'hs_sender_type']
    );
  
    return {
      id: msg.id,
      body: msg.properties?.hs_body ?? '',
      senderId: msg.properties?.hs_sender_id ?? '',
      senderType: msg.properties?.hs_sender_type ?? 'CONTACT',
    };
  }  

  getTenantPrismaService() {
    return this.tenantPrisma;
  }
}
