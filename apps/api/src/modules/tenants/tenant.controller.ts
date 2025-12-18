import { Controller, Get, Req, Res, Post, Body, ForbiddenException, Param, NotFoundException, BadRequestException, UseGuards } from '@nestjs/common';
import { FastifyRequest as Request } from 'fastify';
import { TenantService } from './services/tenant.service';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PermissionGuard } from '../role/guards/permission.guard';
import { RequireTenantPermission } from '../role/guards/permission.decorator';
import { AuditLogService, AuditActions } from '../role/audit-log.service';

@Controller('api/tenant')
export class TenantController {
  constructor(
    private readonly tenants: TenantService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('my')
  async getMyTenants(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    const userId = req.session.user.id;
    const mine = await this.tenants.listTenantsByUser(userId);
    return res.send({ success: true, data: mine });
  }

  @Get(':tenantId/members')
  @UseGuards(PermissionGuard)
  @RequireTenantPermission('member:read')
  async getTenantMembers(@Param('tenantId') tenantId: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    try {
      const members = await this.tenants.getTenantMembers(tenantId);
      return res.send({ success: true, data: members });
    } catch (error) {
      return res.status(500).send({ success: false, message: (error as Error).message });
    }
  }

  @Post('members/addByEmail')
  @UseGuards(PermissionGuard)
  @RequireTenantPermission('member:create')
  async addMemberByEmail(
    @Body() dto: { tenantId: string; email: string; roleId: string },
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply
  ) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    try {
      const currentUserId = req.session.user.id;
      await this.tenants.addMemberByEmail(dto.tenantId, dto.email, dto.roleId, currentUserId);

      // 记录审计日志
      await this.auditLogService.logFromRequest(
        req,
        AuditActions.MEMBER_ADD,
        'tenant_member',
        undefined,
        dto.tenantId,
        { email: dto.email, roleId: dto.roleId },
      );

      return res.send({ success: true, message: '成员添加成功' });
    } catch (error) {
      return res.status(400).send({ success: false, message: (error as Error).message });
    }
  }

  @Post('members/remove')
  @UseGuards(PermissionGuard)
  @RequireTenantPermission('member:delete')
  async removeMember(
    @Body() dto: { tenantId: string; userId: string },
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply
  ) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    try {
      const currentUserId = req.session.user.id;
      await this.tenants.removeMember(dto.tenantId, dto.userId, currentUserId);

      // 记录审计日志
      await this.auditLogService.logFromRequest(
        req,
        AuditActions.MEMBER_REMOVE,
        'tenant_member',
        dto.userId,
        dto.tenantId,
      );

      return res.send({ success: true, message: '成员移除成功' });
    } catch (error) {
      return res.status(400).send({ success: false, message: (error as Error).message });
    }
  }

  @Post('members/updateRole')
  @UseGuards(PermissionGuard)
  @RequireTenantPermission('member:update')
  async updateMemberRole(
    @Body() dto: { tenantId: string; userId: string; roleId: string },
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply
  ) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    try {
      const currentUserId = req.session.user.id;
      await this.tenants.updateMemberRole(dto.tenantId, dto.userId, dto.roleId, currentUserId);

      // 记录审计日志
      await this.auditLogService.logFromRequest(
        req,
        AuditActions.MEMBER_ROLE_CHANGE,
        'tenant_member',
        dto.userId,
        dto.tenantId,
        { newRoleId: dto.roleId },
      );

      return res.send({ success: true, message: '角色更新成功' });
    } catch (error) {
      return res.status(400).send({ success: false, message: (error as Error).message });
    }
  }

  @Post('verify-schema')
  async verifySchema(@Req() req: Request, @Res() res: FastifyReply) {
    // This is a dev-only endpoint for verification
    const tenantId = crypto.randomUUID();
    try {
      await this.tenants.upsertTenant({ id: tenantId }, {
        name: 'Verification Tenant ' + tenantId.slice(0, 8),
        hubspot_id: 'verify-' + Date.now(),
      });
      return res.send({ success: true, message: `Tenant ${tenantId} created and schema initialized.` });
    } catch (e) {
      return res.status(500).send({ success: false, message: (e as Error).message, stack: (e as Error).stack });
    }
  }
}


