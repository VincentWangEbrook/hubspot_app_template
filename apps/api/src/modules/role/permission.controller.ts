import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PermissionService, GroupedPermissions, PermissionDto } from './permission.service';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './guards/permission.decorator';

@Controller('api/permissions')
@UseGuards(PermissionGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  /**
   * 获取所有权限列表
   * GET /api/permissions
   */
  @Get()
  @RequirePermission('permission:read')
  async findAll(
    @Query('scope') scope?: 'system' | 'tenant' | 'all',
  ): Promise<{ success: boolean; data: PermissionDto[] }> {
    const permissions = await this.permissionService.findByScope(scope || 'all');
    return { success: true, data: permissions };
  }

  /**
   * 按资源分组获取权限
   * GET /api/permissions/grouped
   */
  @Get('grouped')
  @RequirePermission('permission:read')
  async findGrouped(
    @Query('scope') scope?: 'system' | 'tenant' | 'all',
  ): Promise<{ success: boolean; data: GroupedPermissions[] }> {
    const grouped = await this.permissionService.findGroupedByResource(scope);
    return { success: true, data: grouped };
  }
}

