import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PermissionDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  scope: string;
}

export interface GroupedPermissions {
  resource: string;
  permissions: PermissionDto[];
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  
  // 权限缓存
  private permissionCache: Map<string, PermissionDto> = new Map();
  private cacheInitialized = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 初始化权限缓存
   */
  async initCache(): Promise<void> {
    if (this.cacheInitialized) return;

    const permissions = await this.prisma.permission.findMany();
    this.permissionCache.clear();
    
    for (const perm of permissions) {
      this.permissionCache.set(perm.code, perm);
    }
    
    this.cacheInitialized = true;
    this.logger.log(`权限缓存已初始化，共 ${permissions.length} 个权限`);
  }

  /**
   * 刷新缓存
   */
  async refreshCache(): Promise<void> {
    this.cacheInitialized = false;
    await this.initCache();
  }

  /**
   * 获取所有权限
   */
  async findAll(): Promise<PermissionDto[]> {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * 按作用域获取权限
   */
  async findByScope(scope: 'system' | 'tenant' | 'all'): Promise<PermissionDto[]> {
    return this.prisma.permission.findMany({
      where: scope === 'all' ? {} : { scope },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * 按资源分组获取权限
   */
  async findGroupedByResource(scope?: 'system' | 'tenant' | 'all'): Promise<GroupedPermissions[]> {
    const permissions = await this.findByScope(scope || 'all');
    
    const grouped = new Map<string, PermissionDto[]>();
    for (const perm of permissions) {
      const list = grouped.get(perm.resource) || [];
      list.push(perm);
      grouped.set(perm.resource, list);
    }

    return Array.from(grouped.entries()).map(([resource, permissions]) => ({
      resource,
      permissions,
    }));
  }

  /**
   * 根据代码获取权限
   */
  async findByCode(code: string): Promise<PermissionDto | null> {
    await this.initCache();
    return this.permissionCache.get(code) || null;
  }

  /**
   * 根据代码列表获取权限
   */
  async findByCodes(codes: string[]): Promise<PermissionDto[]> {
    return this.prisma.permission.findMany({
      where: { code: { in: codes } },
    });
  }

  /**
   * 检查权限代码是否存在
   */
  async exists(code: string): Promise<boolean> {
    await this.initCache();
    return this.permissionCache.has(code);
  }

  /**
   * 获取用户的所有权限（系统级）
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permission.code);
      }
    }

    return Array.from(permissions);
  }

  /**
   * 获取用户在租户内的所有权限
   */
  async getUserTenantPermissions(userId: string, tenantId: string): Promise<string[]> {
    const tenantMember = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!tenantMember) {
      return [];
    }

    return tenantMember.role.rolePermissions.map(rp => rp.permission.code);
  }

  /**
   * 检查用户是否拥有指定权限（系统级）
   */
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return this.checkPermissionMatch(permissions, permissionCode);
  }

  /**
   * 检查用户是否拥有指定权限（租户级）
   */
  async hasTenantPermission(userId: string, tenantId: string, permissionCode: string): Promise<boolean> {
    const permissions = await this.getUserTenantPermissions(userId, tenantId);
    return this.checkPermissionMatch(permissions, permissionCode);
  }

  /**
   * 检查用户是否拥有任一指定权限
   */
  async hasAnyPermission(userId: string, permissionCodes: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissionCodes.some(code => this.checkPermissionMatch(permissions, code));
  }

  /**
   * 检查用户是否拥有所有指定权限
   */
  async hasAllPermissions(userId: string, permissionCodes: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissionCodes.every(code => this.checkPermissionMatch(permissions, code));
  }

  /**
   * 检查权限匹配（支持通配符）
   * 例如：user:* 匹配 user:read, user:update 等
   */
  private checkPermissionMatch(userPermissions: string[], requiredPermission: string): boolean {
    // 直接匹配
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // 检查 manage 权限（manage 包含 create, read, update, delete）
    const [resource, action] = requiredPermission.split(':');
    if (['create', 'read', 'update', 'delete'].includes(action)) {
      if (userPermissions.includes(`${resource}:manage`)) {
        return true;
      }
    }

    // 检查通配符权限 (resource:*)
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }

    // 检查超级权限 (*:*)
    if (userPermissions.includes('*:*')) {
      return true;
    }

    return false;
  }
}

