import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { RoleService, RoleDto, RoleWithPermissions } from './role.service';
import { AuditLogService, AuditActions } from './audit-log.service';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './guards/permission.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto, AssignUserRoleDto } from './dto/assign-permission.dto';

@Controller('api/roles')
@UseGuards(PermissionGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * 获取所有角色
   * GET /api/roles
   */
  @Get()
  @RequirePermission('role:read')
  async findAll(
    @Query('type') type?: 'system' | 'tenant',
    @Query('tenantId') tenantId?: string,
  ): Promise<{ success: boolean; data: RoleDto[] }> {
    const roles = await this.roleService.findAll(type, tenantId);
    return { success: true, data: roles };
  }

  /**
   * 获取角色详情
   * GET /api/roles/:id
   */
  @Get(':id')
  @RequirePermission('role:read')
  async findById(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: RoleWithPermissions }> {
    const role = await this.roleService.findById(id);
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    return { success: true, data: role };
  }

  /**
   * 创建角色
   * POST /api/roles
   */
  @Post()
  @RequirePermission('role:create')
  async create(
    @Body() dto: CreateRoleDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; data: RoleWithPermissions }> {
    const role = await this.roleService.create(dto);

    // 记录审计日志
    await this.auditLogService.logFromRequest(
      req,
      AuditActions.ROLE_CREATE,
      'role',
      role.id,
      dto.tenantId,
      { code: dto.code, name: dto.name, type: dto.type },
    );

    return { success: true, data: role };
  }

  /**
   * 更新角色
   * PUT /api/roles/:id
   */
  @Put(':id')
  @RequirePermission('role:update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; data: RoleWithPermissions }> {
    const role = await this.roleService.update(id, dto);

    // 记录审计日志
    await this.auditLogService.logFromRequest(
      req,
      AuditActions.ROLE_UPDATE,
      'role',
      id,
      undefined,
      { name: dto.name },
    );

    return { success: true, data: role };
  }

  /**
   * 删除角色
   * DELETE /api/roles/:id
   */
  @Delete(':id')
  @RequirePermission('role:delete')
  async delete(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; message: string }> {
    const role = await this.roleService.findById(id);
    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    await this.roleService.delete(id);

    // 记录审计日志
    await this.auditLogService.logFromRequest(
      req,
      AuditActions.ROLE_DELETE,
      'role',
      id,
      undefined,
      { code: role.code, name: role.name },
    );

    return { success: true, message: '角色已删除' };
  }

  /**
   * 为角色分配权限
   * POST /api/roles/:id/permissions
   */
  @Post(':id/permissions')
  @RequirePermission('role:update')
  async assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; data: RoleWithPermissions }> {
    const role = await this.roleService.assignPermissions(id, dto.permissionCodes);

    // 记录审计日志
    await this.auditLogService.logFromRequest(
      req,
      AuditActions.ROLE_UPDATE,
      'role',
      id,
      undefined,
      { permissionCount: dto.permissionCodes.length },
    );

    return { success: true, data: role };
  }

  // ========== 用户角色管理 ==========

  /**
   * 获取用户的系统角色
   * GET /api/roles/users/:userId
   */
  @Get('users/:userId')
  @RequirePermission('user:read')
  async getUserRoles(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean; data: RoleDto[] }> {
    const roles = await this.roleService.getUserRoles(userId);
    return { success: true, data: roles };
  }

  /**
   * 为用户分配系统角色
   * POST /api/roles/users/:userId
   */
  @Post('users/:userId')
  @RequirePermission('user:update')
  async assignUserRole(
    @Param('userId') userId: string,
    @Body() dto: AssignUserRoleDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; message: string }> {
    await this.roleService.assignUserRole(userId, dto.roleId);

    // 记录审计日志
    await this.auditLogService.logFromRequest(
      req,
      AuditActions.ROLE_ASSIGN,
      'user',
      userId,
      undefined,
      { roleId: dto.roleId },
    );

    return { success: true, message: '角色已分配' };
  }

  /**
   * 设置用户的唯一系统角色（替换现有角色）
   * PUT /api/roles/users/:userId
   */
  @Put('users/:userId')
  @RequirePermission('user:update')
  async setUserRole(
    @Param('userId') userId: string,
    @Body() dto: AssignUserRoleDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; message: string }> {
    await this.roleService.setUserRole(userId, dto.roleId);

    // 记录审计日志
    await this.auditLogService.logFromRequest(
      req,
      AuditActions.ROLE_ASSIGN,
      'user',
      userId,
      undefined,
      { roleId: dto.roleId, action: 'set' },
    );

    return { success: true, message: '角色已设置' };
  }

  /**
   * 移除用户的系统角色
   * DELETE /api/roles/users/:userId/:roleId
   */
  @Delete('users/:userId/:roleId')
  @RequirePermission('user:update')
  async removeUserRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; message: string }> {
    await this.roleService.removeUserRole(userId, roleId);

    // 记录审计日志
    await this.auditLogService.logFromRequest(
      req,
      AuditActions.ROLE_REVOKE,
      'user',
      userId,
      undefined,
      { roleId },
    );

    return { success: true, message: '角色已移除' };
  }
}

