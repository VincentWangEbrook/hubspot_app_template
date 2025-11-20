import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { Channel } from './channel.entity';

@Entity('hubspot_conversations')
@Unique(['tenantId', 'hubspotContactId', 'channel'])
export class HubspotConversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: string;

  @Column()
  hubspotContactId: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @CreateDateColumn()
  createdAt: Date;
}
