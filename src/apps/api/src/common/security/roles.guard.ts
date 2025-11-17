import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from './roles.decorator';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少认证信息');
    }
    const token = authHeader.slice(7);
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch (e) {
      throw new UnauthorizedException('无效的或过期的 JWT');
    }

    const userRole: AppRole | undefined = payload?.role;
    if (!userRole) {
      throw new ForbiddenException('缺少角色信息');
    }
    const allowed = requiredRoles.includes(userRole);
    if (!allowed) {
      throw new ForbiddenException('没有访问权限');
    }
    // 可附加 user 到请求对象
    request.user = payload;
    return true;
  }
}


