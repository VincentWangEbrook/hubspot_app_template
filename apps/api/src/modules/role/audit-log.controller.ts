import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { AuditLogService, AuditLogDto, AuditLogQueryOptions } from './audit-log.service';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission, RequireTenantPermission } from './guards/permission.decorator';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('api/audit-logs')
@UseGuards(PermissionGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * 查询审计日志
   * GET /api/audit-logs
   */
  @Get()
  @RequirePermission('audit:read')
  async query(
    @Query() queryDto: AuditLogQueryDto
  ): Promise<{
    success: boolean;
    data: AuditLogDto[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    const options: AuditLogQueryOptions = {
      userId: queryDto.userId,
      tenantId: queryDto.tenantId,
      resource: queryDto.resource,
      action: queryDto.action,
      startDate: queryDto.startDate ? new Date(queryDto.startDate) : undefined,
      endDate: queryDto.endDate ? new Date(queryDto.endDate) : undefined,
      page: queryDto.page ? parseInt(queryDto.page, 10) : 1,
      pageSize: queryDto.pageSize ? parseInt(queryDto.pageSize, 10) : 20,
    };

    const result = await this.auditLogService.query(options);

    return {
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * 获取用户的操作历史
   * GET /api/audit-logs/users/:userId
   */
  @Get('users/:userId')
  @RequirePermission('audit:read')
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; data: AuditLogDto[] }> {
    const data = await this.auditLogService.getUserHistory(
      userId,
      limit ? parseInt(limit, 10) : 50,
    );
    return { success: true, data };
  }

  /**
   * 获取租户的操作历史
   * GET /api/audit-logs/tenants/:tenantId
   */
  @Get('tenants/:tenantId')
  @RequirePermission('audit:read')
  async getTenantHistory(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; data: AuditLogDto[] }> {
    const data = await this.auditLogService.getTenantHistory(
      tenantId,
      limit ? parseInt(limit, 10) : 50,
    );
    return { success: true, data };
  }

  /**
   * 获取资源的操作历史
   * GET /api/audit-logs/resources/:resource/:resourceId
   */
  @Get('resources/:resource/:resourceId')
  @RequirePermission('audit:read')
  async getResourceHistory(
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; data: AuditLogDto[] }> {
    const data = await this.auditLogService.getResourceHistory(
      resource,
      resourceId,
      limit ? parseInt(limit, 10) : 50,
    );
    return { success: true, data };
  }
}

