// 共享的用户类型定义
export interface UserInfo {
  id: string;
  username: string;
  avatar?: string;
  email: string;
  permissions?: string[];
}

// 完整的用户信息
export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  roles?: Role[];
}

// 租户类型
export interface Tenant {
  id: string;
  name: string;
  hubspotId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  desc?: string;
  avatar?: string;
}

// 租户成员类型
export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  role?: Role;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    email: string;
    username?: string;
  };
}

// ========== RBAC 类型定义 ==========

// 权限
export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  scope: 'system' | 'tenant' | 'all';
}

// 按资源分组的权限
export interface GroupedPermissions {
  resource: string;
  permissions: Permission[];
}

// 角色
export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'system' | 'tenant';
  isSystem: boolean;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  permissions?: Array<{
    id: string;
    code: string;
    name: string;
    resource: string;
    action: string;
  }>;
}

// 用户角色关联
export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  role?: Role;
  createdAt: string;
}

// 紧急访问请求
export interface EmergencyAccessRequest {
  id: string;
  requesterId: string;
  tenantId: string;
  reason: string;
  scope: string[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approverId?: string;
  approvedAt?: string;
  expiresAt: string;
  createdAt: string;
  requester?: {
    id: string;
    email: string;
    username: string;
  };
  approver?: {
    id: string;
    email: string;
    username: string;
  };
  tenant?: {
    id: string;
    name: string;
  };
}

// 审计日志
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  tenantId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}