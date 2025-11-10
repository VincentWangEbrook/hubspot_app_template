import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * Tenant 表（租户注册表，存放租户的 meta 信息与加密后的 token）
 * - id: tenantId，由 crypto.randomUUID() 生成（Marketplace 安装回调时）
 * - hubId: HubSpot 返回的 hub_id（可用于唯一识别 HubSpot 帐号）
 * - createdBy: 平台用户 id（owner），用于权限校验
 */
@Entity({ name: 'tenants' })
@Index(['hubId'], { unique: true, where: '"hubId" IS NOT NULL' })
export class Tenant {
  @PrimaryColumn('uuid')
  id: string; // tenantId (UUID)

  @Column()
  name: string;

  @Column({ nullable: true, unique: true })
  hubId: string;
  // 加密后存储 token（注意：已加密，不能直接读）
  @Column({ type: 'text', nullable: true })
  hubspotAccessToken?: string;

  @Column({ type: 'text', nullable: true })
  hubspotRefreshToken?: string;

  @CreateDateColumn({ name: 'hubspotExpiresAt' })
  hubspotExpiresAt?: Date;

  @Column({ type: 'text', nullable: true })
  hubspotScope?: string;

  // 记录哪个平台用户（User.id）创建或拥有该租户
  @Column({ nullable: true })
  createdBy?: string;

  @Column({ type: 'json', nullable: true })
  raw?: any;

  @ManyToOne(() => User, (user) => user.tenants)
  user: Partial<User>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at'})
  updated_at: Date;

  constructor(
    id: string,
    name: string,
    user: Partial<User>,
    hubId: string,
    hubspotAccessToken?: string,
    hubspotRefreshToken?: string,
    hubspotExpiresAt?: Date,
    hubspotScope?: string,
    createdBy?: string,
    raw?: any
  ) {
    this.id = id;
    this.name = name;
    this.hubId = hubId;
    this.hubspotAccessToken = hubspotAccessToken;
    this.hubspotRefreshToken = hubspotRefreshToken;
    this.hubspotExpiresAt = hubspotExpiresAt;
    this.hubspotScope = hubspotScope;
    this.createdBy = createdBy;
    this.raw = raw;
    this.created_at = new Date();
    this.updated_at = new Date();
    this.user = user;
  }
}
