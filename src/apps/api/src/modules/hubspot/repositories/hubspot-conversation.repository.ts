import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { HubspotConversation } from '../entities/hubspot-conversation.entity';
import { Channel } from '../entities/channel.entity';

@Injectable()
export class HubspotConversationRepository {
  constructor(
    @InjectRepository(HubspotConversation)
    private repo: Repository<HubspotConversation>,
  ) {}

  async getConversationId(
    tenantId: string,
    hubspotContactId: string,
    channel: Channel,
  ): Promise<string | null> {
    const record = await this.repo.findOne({ where: { tenantId, hubspotContactId, channel }, relations: ['channel'] });
    return record?.conversationId || null;
  }

  async saveConversationId(
    tenantId: string,
    hubspotContactId: string,
    channel: Channel,
    conversationId: string,
  ) {
    const existing = await this.repo.findOne({ where: { tenantId, hubspotContactId, channel }, relations: ['channel'] });
    if (existing) {
      existing.conversationId = conversationId;
      await this.repo.save(existing);
    } else {
      const newRecord = this.repo.create({ tenantId, hubspotContactId, channel, conversationId });
      await this.repo.save(newRecord);
    }
  }
}
