import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';
import { CommonSecurityModule } from '../../common/security/common.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), CommonSecurityModule],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
