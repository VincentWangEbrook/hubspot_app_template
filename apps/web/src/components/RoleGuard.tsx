'use client';

import { ReactNode } from 'react';
import { useUser } from '@/context/UserContext';

/**
 * 检查权限是否匹配（支持通配符和 manage 权限）
 */
function checkPermissionMatch(userPermissions: string[], requiredPermission: string): boolean {
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

// ========== 旧版角色守卫（向后兼容）==========

// 旧的角色类型（向后兼容）
type LegacySystemRole = 'admin' | 'user';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: LegacySystemRole[];
  fallback?: ReactNode;
}

/**
 * RoleGuard Component (向后兼容)
 * 基于旧的硬编码角色条件渲染子组件
 * 
 * @deprecated 建议使用 PermissionGuard 组件代替，基于权限而非角色进行访问控制
 * 
 * @example
 * <RoleGuard allowedRoles={['admin']}>
 *   <AdminPanel />
 * </RoleGuard>
 */
export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { user, isLoading } = useUser();

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // User not logged in
  if (!user) {
    return <>{fallback}</>;
  }

  // 新的基于权限的检查
  // admin 角色映射到 user:read 权限
  // user 角色映射到无特殊权限
  const userPermissions = user.permissions || [];
  
  // 检查是否是管理员（有系统管理权限）
  const isAdmin = checkPermissionMatch(userPermissions, 'user:read');
  
  // 角色权限映射
  if (allowedRoles.includes('admin') && isAdmin) {
    return <>{children}</>;
  }
  
  if (allowedRoles.includes('user') && !allowedRoles.includes('admin')) {
    // 只要求 user 角色，所有登录用户都可以
    return <>{children}</>;
  }

  // 如果只要求 admin 但用户不是 admin
  if (allowedRoles.includes('admin') && !isAdmin) {
    return <>{fallback}</>;
  }

  return <>{fallback}</>;
}

// ========== 租户角色守卫 ==========

interface TenantRoleGuardProps {
  children: ReactNode;
  tenantId: string;
  allowedRoles: string[];
  currentUserRole?: string;
  fallback?: ReactNode;
}

/**
 * TenantRoleGuard Component
 * 基于用户在特定租户中的角色条件渲染子组件
 * 
 * @example
 * <TenantRoleGuard tenantId={tenantId} allowedRoles={['tenant_owner', 'tenant_admin']} currentUserRole={memberRole}>
 *   <AddMemberButton />
 * </TenantRoleGuard>
 */
export function TenantRoleGuard({ 
  children, 
  tenantId, 
  allowedRoles, 
  currentUserRole,
  fallback = null 
}: TenantRoleGuardProps) {
  // If no role provided, don't render
  if (!currentUserRole || !allowedRoles.includes(currentUserRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ========== 新版权限守卫 ==========

interface PermissionRoleGuardProps {
  children: ReactNode;
  permissions: string | string[];  // 所需权限（单个或多个）
  mode?: 'all' | 'any';            // all=需要全部权限，any=任一权限即可
  fallback?: ReactNode;            // 无权限时显示的内容
}

/**
 * PermissionRoleGuard 组件
 * 基于用户权限条件渲染子组件（在 RoleGuard 文件中导出，方便迁移）
 * 
 * @example
 * <PermissionRoleGuard permissions="user:read">
 *   <UserList />
 * </PermissionRoleGuard>
 */
export function PermissionRoleGuard({ 
  children, 
  permissions, 
  mode = 'all',
  fallback = null 
}: PermissionRoleGuardProps) {
  const { user, isLoading } = useUser();

  // 加载中不渲染
  if (isLoading) {
    return null;
  }

  // 用户未登录
  if (!user) {
    return <>{fallback}</>;
  }

  const userPermissions = user.permissions || [];
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

  // 检查权限
  const hasPermission = mode === 'any'
    ? requiredPermissions.some(perm => checkPermissionMatch(userPermissions, perm))
    : requiredPermissions.every(perm => checkPermissionMatch(userPermissions, perm));

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
