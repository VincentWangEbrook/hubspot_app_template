import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export type TenantMemberRole = 'owner' | 'admin' | 'member';

@Entity({ name: 'tenant_members' })
@Index(['tenantId', 'userId'], { unique: true })
export class TenantMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', default: 'member' })
  role: TenantMemberRole;

  constructor(
    id: string,
    tenantId: string,
    userId: string,
    role: TenantMemberRole
  ){
    this.id = id;
    this.tenantId = tenantId;
    this.userId = userId;
    this.role = role;
  } 
}


