import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { LineChannel } from './line-channel.entity';

@Entity('line_messages')
export class LineMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '对话通道 ID（关联 line_channels.id）' })
  channelId: number;

  @Column({ type: 'text', comment: '消息内容' })
  content: string;

  @Column({ comment: '是否 Line 用户发送（true=是，false=HubSpot 回复）' })
  isLine: boolean;

  // 关联租户 ID（关键：多租户隔离）
  @Column({ comment: '租户 ID' })
  tenantId: string;

  // 可选：添加租户关联
  @ManyToOne(() => Tenant, (tenant) => tenant.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // 可选：添加通道关联
  @ManyToOne(() => LineChannel, (channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: LineChannel;

  @CreateDateColumn({ comment: '发送时间' })
  createdAt: Date;
}