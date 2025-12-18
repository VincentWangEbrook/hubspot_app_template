'use client';

import { ReactNode } from 'react';
import { useUser } from '@/context/UserContext';

interface PermissionGuardProps {
  children: ReactNode;
  permissions: string | string[];  // 所需权限（单个或多个）
  mode?: 'all' | 'any';            // all=需要全部权限，any=任一权限即可
  fallback?: ReactNode;            // 无权限时显示的内容
}

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

/**
 * PermissionGuard 组件
 * 基于用户权限条件渲染子组件
 * 
 * @example
 * // 需要单个权限
 * <PermissionGuard permissions="user:read">
 *   <UserList />
 * </PermissionGuard>
 * 
 * @example
 * // 需要所有权限
 * <PermissionGuard permissions={['user:read', 'user:update']} mode="all">
 *   <UserEditor />
 * </PermissionGuard>
 * 
 * @example
 * // 任一权限即可
 * <PermissionGuard permissions={['admin:*', 'user:manage']} mode="any">
 *   <AdminPanel />
 * </PermissionGuard>
 */
export function PermissionGuard({ 
  children, 
  permissions, 
  mode = 'all',
  fallback = null 
}: PermissionGuardProps) {
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

/**
 * 无权限提示组件
 */
export function NoPermissionFallback({ message }: { message?: string }) {
  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
        {message || '您没有权限访问此页面。'}
      </div>
    </div>
  );
}

/**
 * Hook: 检查当前用户是否拥有指定权限
 */
export function useHasPermission(permissions: string | string[], mode: 'all' | 'any' = 'all'): boolean {
  const { user } = useUser();
  
  if (!user) return false;

  const userPermissions = user.permissions || [];
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

  return mode === 'any'
    ? requiredPermissions.some(perm => checkPermissionMatch(userPermissions, perm))
    : requiredPermissions.every(perm => checkPermissionMatch(userPermissions, perm));
}

