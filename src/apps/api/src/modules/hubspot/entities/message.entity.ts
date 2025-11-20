import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Channel } from './channel.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column()
  tenantId: string;

  @Column('text')
  content: string;

  @Column()
  isFromUser: boolean; // true=用户发, false=HubSpot 回复

  @CreateDateColumn()
  createdAt: Date;
}
