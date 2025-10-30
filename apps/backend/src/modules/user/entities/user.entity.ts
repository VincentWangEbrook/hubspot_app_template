import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  username?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @OneToMany(() => Tenant, (tenant) => tenant.user)
  tenants?: Tenant[];

  constructor(
    id: string,
    email: string,
    password: string,
    username?: string
  ) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.username = username;
    this.created_at = new Date();
  }
}