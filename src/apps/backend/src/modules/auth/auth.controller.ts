import { Controller, Get, Post, Body, Req, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TenantService } from '../tenant/tenant.service';
import { FastifyRequest as Request } from 'fastify';
import { TenantDbService } from '../tenant/tenant-db.service';
import { Roles } from '../../common/security/roles.decorator';
import { RolesGuard } from '../../common/security/roles.guard';
import { User } from '../user/entities/user.entity';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenantService: TenantService,
    private readonly tenantDb: TenantDbService
  ) {}

  @Get('hubspot/url')
  getHubSpotAuthUrl(@Query('state') state = 'default') {
    return { url: this.auth.getAuthorizationUrl(state) };
  }

  // 前端从前面拿到 code 后，发送 POST /api/auth/hubspot { code, tenantId }
  // 这里我们期望 Authorization header 中携带 JWT，表明当前登录用户
  @Post('hubspot')
  async handleHubspotCallback(@Req() req: Request, @Body() body: { code: string; tenantId: string }) {
    const authHeader = req.headers['authorization'] as string | undefined;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        // decode JWT or use AuthUserService to validate (示例简化)
        const token = authHeader.slice(7);
        const payload = this.auth.verifyJwt(token); // 你需要在 AuthService 中实现 verifyJwt 或使用 JwtService
        userId = payload?.sub;
      } catch (err) {
        console.log(err)
        // 如果没有登录用户，可以允许为匿名，也可以拒绝
        userId = undefined;
      }
    }

    if (!userId) {
      throw new UnauthorizedException('用户 ID 不存在，请重新登录');
    }

    const { code, tenantId } = body;
    if (!code) return { success: false, message: 'Missing code' };
    if (!tenantId) return { success: false, message: 'Missing tenantId' };
    console.log('code: ' + code, 'tenantId: ' + tenantId);
    // 交换 token
    const tokenData = await this.auth.exchangeCodeForToken(code, tenantId);

    if (!tokenData) return { success: false, message: 'Failed to exchange token' };

    console.log('tokenData: ', tokenData);
    // tokenData 包含 access_token, refresh_token, hub_id...
    const hubId = tokenData.hub_id ?? tokenData.hubId;

    // 如果前端没有传 tenantId（比如 marketplace 安装没生成），我们可尝试用 hubId 查找已存在 tenant，
    // 如果 hubId 未找到，就生成一个新的 tenantId（crypto.randomUUID）
    const candidateTenantId = tenantId ?? crypto.randomUUID();

    // Upsert tenant：使用 hubId 或 tenantId 做匹配，设置 createdBy = userId（如果有）
    const t = await this.tenantService.upsertTenant(
      { id: candidateTenantId, hubId },
      {
        name: `HubSpot ${hubId ?? candidateTenantId}`,
        hubId,
        hubspotAccessToken: tokenData.access_token,
        hubspotRefreshToken: tokenData.refresh_token,
        raw: tokenData,
        createdBy: userId,
        hubspotScope: tokenData.scopes,
        user: {id: userId}
      },
      { setCreatedByIfMissing: true },
    );

    // Ensure per-tenant schema exists (and base tables) after authorization
    await this.tenantDb.ensureSchema(t.id);

    return { success: true, tenant: t };
  }
}
