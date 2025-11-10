import { Controller, Get, Req, Post, Body, ForbiddenException, Param } from '@nestjs/common';
import { FastifyRequest as Request } from 'fastify';
import { TenantService } from './tenant.service';
import { JwtService } from '@nestjs/jwt';
import { TenantMemberRole } from './entities/tenant-member.entity';

@Controller('api/tenant')
export class TenantController {
  constructor(private readonly tenants: TenantService, private readonly jwtService: JwtService) {}

  @Get('my')
  async getMyTenants(@Req() req: Request) {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      return { success: false, message: 'Missing auth' };
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(authHeader.slice(7));
    } catch(err) {
      console.error('Invalid token', err);
      return { success: false, message: 'Invalid token' };
    }
    const userId = payload?.sub as string;
    if (!userId) return { success: false, message: 'Invalid token payload' };
    const mine = await this.tenants.listTenantsByUser(userId);
    return { success: true, data: mine };
  }

  @Post('members/add')
  async addMember(
    @Req() req: Request,
    @Body() body: { tenantId: string; userId: string; role?: TenantMemberRole }
  ) {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) return { success: false, message: 'Missing auth' };
    const payload = this.jwtService.verify(authHeader.slice(7));
    const requesterId = payload?.sub as string;
    const t = await this.tenants.getTenant({ id: body.tenantId });
    if (!t || t.createdBy !== requesterId) throw new ForbiddenException('Only owner can manage members');
    const m = await this.tenants.addMember(body.tenantId, body.userId, body.role ?? 'member');
    return { success: true, data: m };
  }

  @Post('members/remove')
  async removeMember(
    @Req() req: Request,
    @Body() body: { tenantId: string; userId: string }
  ) {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) return { success: false, message: 'Missing auth' };
    const payload = this.jwtService.verify(authHeader.slice(7));
    const requesterId = payload?.sub as string;
    const t = await this.tenants.getTenant({ id: body.tenantId });
    if (!t || t.createdBy !== requesterId) throw new ForbiddenException('Only owner can manage members');
    await this.tenants.removeMember(body.tenantId, body.userId);
    return { success: true };
  }

  @Get(':tenantId/members')
  async listMembers(@Req() req: Request, @Param('tenantId') tenantId: string) {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) return { success: false, message: 'Missing auth' };
    const payload = this.jwtService.verify(authHeader.slice(7));
    const requesterId = payload?.sub as string;
    const allowed = await this.tenants.isMemberOrOwner(tenantId, requesterId);
    if (!allowed) throw new ForbiddenException('无权访问该租户成员列表');
    const members = await this.tenants.listMembersWithUserInfo(tenantId);
    return { success: true, data: members };
  }

  @Post('members/addByEmail')
  async addMemberByEmail(
    @Req() req: Request,
    @Body() body: { tenantId: string; email: string; role?: TenantMemberRole }
  ) {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) return { success: false, message: 'Missing auth' };
    const payload = this.jwtService.verify(authHeader.slice(7));
    const requesterId = payload?.sub as string;
    const t = await this.tenants.getTenant({ id: body.tenantId });
    if (!t || t.createdBy !== requesterId) throw new ForbiddenException('Only owner can manage members');
    const m = await this.tenants.addMemberByEmail(body.tenantId, body.email.toLowerCase(), body.role ?? 'member');
    return { success: true, data: m };
  }

  @Post('members/updateRole')
  async updateMemberRole(
    @Req() req: Request,
    @Body() body: { tenantId: string; userId: string; role: TenantMemberRole }
  ) {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) return { success: false, message: 'Missing auth' };
    const payload = this.jwtService.verify(authHeader.slice(7));
    const requesterId = payload?.sub as string;
    const t = await this.tenants.getTenant({ id: body.tenantId });
    if (!t || t.createdBy !== requesterId) throw new ForbiddenException('Only owner can manage members');
    const m = await this.tenants.updateMemberRole(body.tenantId, body.userId, body.role);
    return { success: true, data: m };
  }
}


