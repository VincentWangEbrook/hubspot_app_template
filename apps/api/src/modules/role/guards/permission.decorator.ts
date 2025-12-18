import { SetMetadata } from '@nestjs/common';

// 权限元数据键
export const PERMISSIONS_KEY = 'permissions';
export const TENANT_PERMISSIONS_KEY = 'tenant_permissions';
export const PERMISSION_MODE_KEY = 'permission_mode';

// 权限模式：all = 需要所有权限，any = 任一权限即可
export type PermissionMode = 'all' | 'any';

/**
 * 系统级权限装饰器
 * 需要用户拥有指定的系统权限
 * 
 * @example
 * @RequirePermission('user:read')
 * @RequirePermission(['user:read', 'user:update'])
 */
export const RequirePermission = (permissions: string | string[]) => {
  const permArray = Array.isArray(permissions) ? permissions : [permissions];
  return SetMetadata(PERMISSIONS_KEY, permArray);
};

/**
 * 系统级权限装饰器（任一权限即可）
 * 
 * @example
 * @RequireAnyPermission(['user:manage', 'admin:*'])
 */
export const RequireAnyPermission = (permissions: string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(PERMISSIONS_KEY, permissions)(target, key!, descriptor!);
    SetMetadata(PERMISSION_MODE_KEY, 'any')(target, key!, descriptor!);
    return descriptor;
  };
};

/**
 * 租户级权限装饰器
 * 需要用户在指定租户内拥有指定权限
 * 租户 ID 从请求参数中获取（params.tenantId 或 body.tenantId）
 * 
 * @example
 * @RequireTenantPermission('member:update')
 * @RequireTenantPermission(['hubspot:read', 'line:read'])
 */
export const RequireTenantPermission = (permissions: string | string[]) => {
  const permArray = Array.isArray(permissions) ? permissions : [permissions];
  return SetMetadata(TENANT_PERMISSIONS_KEY, permArray);
};

/**
 * 租户级权限装饰器（任一权限即可）
 * 
 * @example
 * @RequireAnyTenantPermission(['member:manage', 'tenant_role:manage'])
 */
export const RequireAnyTenantPermission = (permissions: string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(TENANT_PERMISSIONS_KEY, permissions)(target, key!, descriptor!);
    SetMetadata(PERMISSION_MODE_KEY, 'any')(target, key!, descriptor!);
    return descriptor;
  };
};

