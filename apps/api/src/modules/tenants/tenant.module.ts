import { Module, Global } from '@nestjs/common';
import { TenantService } from './services/tenant.service';
import { TenantDbService } from './services/tenant-db.service';
import { CommonSecurityModule } from '../../common/security/common.module';
import { TenantController } from './tenant.controller';
import { SharedModule } from '../../shared/shared.module'
import { SchemaManagerService } from './services/schema-manager.service';

@Global()
@Module({
  imports: [CommonSecurityModule, SharedModule],
  providers: [TenantService, SchemaManagerService, TenantDbService],
  controllers: [TenantController],
  exports: [TenantService, SchemaManagerService, TenantDbService],
})
export class TenantModule {}
