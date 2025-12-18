import { Controller, Get, Post, Body, Req, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TenantService } from '../tenants/services/tenant.service';
import { FastifyRequest } from 'fastify';
import { TenantDbService } from '../tenants/services/tenant-db.service';
import { Public } from '../../common/security/public.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenantService: TenantService,
    private readonly tenantDb: TenantDbService
  ) {}

  @Public()
  @Get('hubspot/url')
  getHubSpotAuthUrl(@Query('state') state = 'default') {
    return { url: this.auth.getAuthorizationUrl(state) };
  }

  // 前端从前面拿到 code 后，发送 POST /api/auth/hubspot { code, tenantId }
  // 这里我们期望用户已经登录（通过 session）
  @Post('hubspot')
  async handleHubspotCallback(@Req() req: FastifyRequest, @Body() body: { code: string; tenantId: string }) {
    const { code, tenantId } = body;

    if (!code) return { success: false, message: 'Missing code' };
    if (!tenantId) return { success: false, message: 'Missing tenantId' };

    // 交换 token
    const tokenData = await this.auth.exchangeCodeForToken(code);

    if (!tokenData) return { success: false, message: 'Failed to exchange token' };

    // tokenData 包含 access_token, refresh_token, hubspot_id...
    const hubId = String(tokenData.hub_id);

    // 如果前端没有传 tenantId（比如 marketplace 安装没生成），我们可尝试用 hubspot_id 查找已存在 tenant，
    // 如果 hubspot_id 未找到，就生成一个新的 tenantId（crypto.randomUUID）
    const candidateTenantId = tenantId ?? crypto.randomUUID();

    // Upsert tenant：使用 hubspot_id 或 tenantId 做匹配，设置 createdBy = userId（如果有）
    const t = await this.tenantService.upsertTenant(
      { id: candidateTenantId, hubspot_id: hubId },
      {
        name: `HubSpot ${hubId ?? candidateTenantId}`,
        hubspotAccessToken: tokenData.access_token,
        hubspotRefreshToken: tokenData.refresh_token,
        raw: tokenData,
        createdBy: req.session.user?.id,
        hubspotScope: tokenData.scopes,
        hubspotExpiresAt: tokenData.expires_in,
      },
      { setCreatedByIfMissing: true },
    );

    // Ensure per-tenant schema exists (and base tables) after authorization
    await this.tenantDb.ensureSchema(t.id);

    return { success: true, tenant: t };
  }
}
