import { Injectable } from '@nestjs/common';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { Channel } from '../entities/channel.entity';
import { Message } from '../entities/message.entity';
import { HubspotConversation } from '../entities/hubspot-conversation.entity';

@Injectable()
export class TenantDataSourceFactory {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute a callback within a tenant-specific schema context.
   * This ensures that all queries within the callback use the correct 'search_path'.
   */
  async runInTenantContext<T>(
    tenantId: string,
    callback: (repos: {
      channelRepo: Repository<Channel>;
      messageRepo: Repository<Message>;
      conversationRepo: Repository<HubspotConversation>;
      manager: EntityManager;
    }) => Promise<T>,
  ): Promise<T> {
    const schemaName = `tenant_${tenantId}`;
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      // Set the search path for this session
      await queryRunner.query(`SET search_path TO "${schemaName}", public`);

      const manager = queryRunner.manager;
      const channelRepo = manager.getRepository(Channel);
      const messageRepo = manager.getRepository(Message);
      const conversationRepo = manager.getRepository(HubspotConversation);

      return await callback({ channelRepo, messageRepo, conversationRepo, manager });
    } finally {
      // Reset search path (optional if connection is released, but good practice)
      // await queryRunner.query('SET search_path TO public'); 
      await queryRunner.release();
    }
  }
}
