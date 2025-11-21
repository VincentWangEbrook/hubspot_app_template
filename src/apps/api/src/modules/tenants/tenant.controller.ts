import { Controller, Get, Req, Res, Post, Body, ForbiddenException, Param } from '@nestjs/common';
import { FastifyRequest as Request } from 'fastify';
import { TenantService } from './services/tenant.service';
import { JwtService } from '@nestjs/jwt';
import { TenantMemberRole } from './entities/tenant-member.entity';
import { FastifyRequest, FastifyReply } from 'fastify';

@Controller('api/tenant')
export class TenantController {
  constructor(private readonly tenants: TenantService, private readonly jwtService: JwtService) {}

  @Get('my')
  async getMyTenants(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send({ success: false, message: '未登录' });
    }

    const userId = req.session.user.id;
    const mine = await this.tenants.listTenantsByUser(userId);
    return res.send({ success: true, data: mine });
  }

  @Post('verify-schema')
  async verifySchema(@Req() req: Request, @Res() res: FastifyReply) {
    // This is a dev-only endpoint for verification
    const tenantId = crypto.randomUUID();
    try {
      await this.tenants.upsertTenant({ id: tenantId }, {
        name: 'Verification Tenant ' + tenantId.slice(0, 8),
        hubId: 'verify-' + Date.now(),
      });
      return res.send({ success: true, message: `Tenant ${tenantId} created and schema initialized.` });
    } catch (e) {
      return res.status(500).send({ success: false, message: e.message, stack: e.stack });
    }
  }
}


