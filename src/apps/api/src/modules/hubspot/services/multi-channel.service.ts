import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { HubspotClientFactory } from './hubspot-client.factory';
import { Channel } from '@prisma/client';
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
      
      const channel = await tx.channel.findUnique({
        where: {
          tenantId_channelType_externalUserId: {
            tenantId,
            channelType,
            externalUserId,
          },
        },
      });

      if (!channel) throw new Error(`Channel not bound for tenant=${tenantId} user=${externalUserId}`);

      const msg = await tx.message.create({
        data: {
          channelId: channel.id,
          tenantId,
          content,
          isFromUser: true,
        },
      });
      return channel;
    });
  }

  // 保存 outgoing (HubSpot->channel) 到 DB
  async saveOutgoingMessage(
    tenantId: string,
    params: { channel: Channel; content: string },
  ) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const msg = await tx.message.create({
        data: {
          channelId: params.channel.id,
          tenantId,
          content: params.content,
          isFromUser: false,
        },
      });
      return msg;
    });
  }

  // 确保 HubSpot Contact 存在
  async ensureHubspotContact(tenantId: string, channel: Channel) {
    if (channel.hubspotContactId) return channel.hubspotContactId;
    throw new Error('Channel missing hubspotContactId - create mapping first');
  }

  // 确保 conversation mapping 存在（关系查询）
  async ensureHubspotConversation(tenantId: string, channel: Channel) {
    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const existing = await tx.hubspotConversation.findUnique({
        where: {
          tenantId_hubspotContactId_channelId: {
            tenantId,
            hubspotContactId: channel.hubspotContactId,
            channelId: channel.id,
          },
        },
      });
      
      if (existing) return existing.conversationId;

      const client = await this.hubspotClientFactory.getClient(tenantId);
      const created = await client.crm.objects.basicApi.create('conversations', {
        properties: {
          hs_thread_subject: `${channel.channelType} Chat (${channel.hubspotContactId})`,
          hs_channel_type: 'CUSTOM',
          hs_channel_source: channel.channelType,
        },
      });

      await tx.hubspotConversation.create({
        data: {
          tenantId,
          hubspotContactId: channel.hubspotContactId,
          channelId: channel.id,
          conversationId: created.id,
        },
      });
      return created.id;
    });
  }

  // 把消息发送到 HubSpot conversation_messages
  async sendMessageToHubspot(tenantId: string, channel: Channel, content: string, senderType: 'CONTACT'|'USER'='CONTACT') {
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
      body: msg.properties?.hs_body,
      senderId: msg.properties?.hs_sender_id,
      senderType: msg.properties?.hs_sender_type,
      raw: msg
    };
  }  

  getTenantPrismaService() {
    return this.tenantPrisma;
  }
}
