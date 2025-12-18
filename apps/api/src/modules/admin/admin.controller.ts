import { Controller, Get, Delete, Param, Req, Res, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminService } from './admin.service';
import { PermissionGuard } from '../role/guards/permission.guard';
import { RequirePermission } from '../role/guards/permission.decorator';
import { AuditLogService, AuditActions } from '../role/audit-log.service';

@Controller('api/admin')
@UseGuards(PermissionGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Get all users in the system
   * GET /api/admin/users
   */
  @Get('users')
  @RequirePermission('user:read')
  async getAllUsers(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    try {
      const users = await this.adminService.getAllUsers();
      return res.send({ success: true, data: users });
    } catch (error) {
      return res.status(500).send({ success: false, message: (error as Error).message });
    }
  }

  /**
   * Get all tenants in the system (metadata only)
   * GET /api/admin/tenants
   */
  @Get('tenants')
  @RequirePermission('tenant:read')
  async getAllTenants(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    try {
      const tenants = await this.adminService.getAllTenants();
      return res.send({ success: true, data: tenants });
    } catch (error) {
      return res.status(500).send({ success: false, message: (error as Error).message });
    }
  }

  /**
   * Delete a user
   * DELETE /api/admin/users/:userId
   */
  @Delete('users/:userId')
  @RequirePermission('user:delete')
  async deleteUser(
    @Param('userId') userId: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply
  ) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    const currentUserId = req.session.user.id;

    // Prevent admin from deleting themselves
    if (userId === currentUserId) {
      throw new BadRequestException('不能删除自己的账号');
    }

    try {
      const result = await this.adminService.deleteUser(userId);

      // 记录审计日志
      await this.auditLogService.logFromRequest(
        req,
        AuditActions.USER_DELETE,
        'user',
        userId,
        undefined,
        { deletedBy: currentUserId },
      );

      return res.send(result);
    } catch (error) {
      return res.status(400).send({ success: false, message: (error as Error).message });
    }
  }
}
