import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { TenantService } from '../../modules/tenants/services/tenant.service';

/**
 * 租户成员权限守卫
 * 验证用户是否是指定租户的成员（owner/admin/member）
 * 
 * 使用方式：
 * @UseGuards(TenantMemberGuard)
 * async getContacts(@Query('tenantId') tenantId: string) { ... }
 */
@Injectable()
export class TenantMemberGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    
    // 1. 获取用户信息（支持session和其他认证方式）
    const user = (request.session as any)?.user || (request as any).user;
    if (!user?.id) {
      throw new ForbiddenException('未登录，请先登录');
    }

    // 2. 获取租户ID（支持query参数和路径参数）
    const tenantId = this.extractTenantId(request);
    if (!tenantId) {
      throw new ForbiddenException('缺少租户ID参数');
    }

    // 3. 验证租户成员权限
    const isMember = await this.tenantService.isMemberOrOwner(tenantId, user.id);
    if (!isMember) {
      throw new ForbiddenException('无权访问该租户');
    }

    // 权限验证通过，将userId和tenantId附加到request上供后续使用
    request.userId = user.id;
    request.tenantId = tenantId;

    return true;
  }

  /**
   * 从请求中提取租户ID
   * 优先级：query.tenantId > params.tenantId > body.tenantId
   */
  private extractTenantId(request: any): string | null {
    return (
      request.query?.tenantId ||
      request.params?.tenantId ||
      request.body?.tenantId ||
      request.headers?.['x-tenant-id'] ||
      null
    );
  }
}
