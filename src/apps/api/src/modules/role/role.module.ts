import { Module, Global } from '@nestjs/common';
import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { EmergencyAccessService } from './emergency-access.service';
import { RoleController } from './role.controller';
import { PermissionController } from './permission.controller';
import { AuditLogController } from './audit-log.controller';
import { EmergencyAccessController } from './emergency-access.controller';
import { PermissionGuard } from './guards/permission.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [
    RoleController,
    PermissionController,
    AuditLogController,
    EmergencyAccessController,
  ],
  providers: [
    RoleService,
    PermissionService,
    AuditLogService,
    EmergencyAccessService,
    PermissionGuard,
  ],
  exports: [
    RoleService,
    PermissionService,
    AuditLogService,
    EmergencyAccessService,
    PermissionGuard,
  ],
})
export class RoleModule {}

