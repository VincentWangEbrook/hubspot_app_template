import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../permission.service';
import { 
  PERMISSIONS_KEY, 
  TENANT_PERMISSIONS_KEY, 
  PERMISSION_MODE_KEY,
  PermissionMode,
} from './permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取系统级权限要求
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 获取租户级权限要求
    const requiredTenantPermissions = this.reflector.getAllAndOverride<string[]>(TENANT_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 获取权限模式
    const mode = this.reflector.getAllAndOverride<PermissionMode>(PERMISSION_MODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || 'all';

    // 如果没有权限要求，则允许访问
    if (!requiredPermissions?.length && !requiredTenantPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.session?.user;

    // 检查用户是否登录
    if (!user?.id) {
      throw new ForbiddenException('请先登录');
    }

    // 检查系统级权限
    if (requiredPermissions?.length) {
      const hasPermission = await this.checkSystemPermissions(user.id, requiredPermissions, mode);
      if (!hasPermission) {
        this.logger.warn(`用户 ${user.id} 缺少系统权限: ${requiredPermissions.join(', ')}`);
        throw new ForbiddenException(`权限不足，需要: ${requiredPermissions.join(', ')}`);
      }
    }

    // 检查租户级权限
    if (requiredTenantPermissions?.length) {
      // 从请求中获取租户 ID
      const tenantId = request.params?.tenantId || request.body?.tenantId || request.query?.tenantId;
      
      if (!tenantId) {
        throw new BadRequestException('缺少租户 ID');
      }

      const hasPermission = await this.checkTenantPermissions(user.id, tenantId, requiredTenantPermissions, mode);
      if (!hasPermission) {
        this.logger.warn(`用户 ${user.id} 在租户 ${tenantId} 缺少权限: ${requiredTenantPermissions.join(', ')}`);
        throw new ForbiddenException(`租户权限不足，需要: ${requiredTenantPermissions.join(', ')}`);
      }
    }

    return true;
  }

  /**
   * 检查系统级权限
   */
  private async checkSystemPermissions(
    userId: string, 
    requiredPermissions: string[], 
    mode: PermissionMode
  ): Promise<boolean> {
    if (mode === 'any') {
      return this.permissionService.hasAnyPermission(userId, requiredPermissions);
    }
    return this.permissionService.hasAllPermissions(userId, requiredPermissions);
  }

  /**
   * 检查租户级权限
   */
  private async checkTenantPermissions(
    userId: string,
    tenantId: string,
    requiredPermissions: string[],
    mode: PermissionMode
  ): Promise<boolean> {
    const userPermissions = await this.permissionService.getUserTenantPermissions(userId, tenantId);

    if (mode === 'any') {
      return requiredPermissions.some(perm => 
        this.checkPermissionMatch(userPermissions, perm)
      );
    }

    return requiredPermissions.every(perm => 
      this.checkPermissionMatch(userPermissions, perm)
    );
  }

  /**
   * 检查权限匹配（支持通配符）
   */
  private checkPermissionMatch(userPermissions: string[], requiredPermission: string): boolean {
    // 直接匹配
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // 检查 manage 权限
    const [resource, action] = requiredPermission.split(':');
    if (['create', 'read', 'update', 'delete'].includes(action)) {
      if (userPermissions.includes(`${resource}:manage`)) {
        return true;
      }
    }

    // 检查通配符权限
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }

    // 检查超级权限
    if (userPermissions.includes('*:*')) {
      return true;
    }

    return false;
  }
}

