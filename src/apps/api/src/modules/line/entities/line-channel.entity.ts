import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('line_channels')
export class LineChannel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, comment: 'Line 用户 ID' })
  lineUserId: string;

  @Column({ comment: 'HubSpot 联系人 ID' })
  hubspotContactId: string;

  // 关联租户 ID（关键：多租户隔离）
  @Column({ comment: '租户 ID' })
  tenantId: string;

  // 可选：添加租户关联（便于 TypeORM 关联查询）
  @ManyToOne(() => Tenant, (tenant) => tenant.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}