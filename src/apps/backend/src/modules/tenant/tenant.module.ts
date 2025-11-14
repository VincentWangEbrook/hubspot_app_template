import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';
import { TenantMember } from './entities/tenant-member.entity';
import { UserEntity } from '../user/entities/user.entity';
import { CommonSecurityModule } from '../../common/security/common.module';
import { TenantDbService } from './tenant-db.service';
import { TenantController } from './tenant.controller';
import { SharedModule } from '../../shared/shared.module'
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantMember, UserEntity]), CommonSecurityModule, SharedModule],
  providers: [TenantService, TenantDbService],
  controllers: [TenantController],
  exports: [TenantService, TenantDbService],
})
export class TenantModule {}
