import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,OneToMany } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  username: string;

  @Column({ type: 'varchar', default: 'user' })
  role: 'admin' | 'user';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Tenant, (tenant) => tenant.user)
  tenants?: Tenant[];

  constructor(
    id: string,
    email: string,
    password: string,
    username: string
  ) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.username = username;
    this.createdAt = new Date();
    this.role = 'user';
  }
}