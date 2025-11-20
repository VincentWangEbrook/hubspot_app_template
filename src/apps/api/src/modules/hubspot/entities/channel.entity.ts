import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('channels')
@Unique(['tenantId', 'channelType', 'externalUserId'])
export class Channel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: string;

  @Column()
  channelType: 'LINE' | 'WECHAT' | 'OTHER';

  @Column()
  externalUserId: string; // LineUserId / WeChat OpenId

  @Column()
  hubspotContactId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
