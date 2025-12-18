import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 权限定义
const permissions = [
  // ========== 系统管理权限 (System Scope) ==========
  // 用户管理
  { code: 'user:create', name: '创建用户', resource: 'user', action: 'create', scope: 'system' },
  { code: 'user:read', name: '查看用户', resource: 'user', action: 'read', scope: 'system' },
  { code: 'user:update', name: '更新用户', resource: 'user', action: 'update', scope: 'system' },
  { code: 'user:delete', name: '删除用户', resource: 'user', action: 'delete', scope: 'system' },
  { code: 'user:manage', name: '管理用户', resource: 'user', action: 'manage', scope: 'system' },
  
  // 角色管理
  { code: 'role:create', name: '创建角色', resource: 'role', action: 'create', scope: 'system' },
  { code: 'role:read', name: '查看角色', resource: 'role', action: 'read', scope: 'system' },
  { code: 'role:update', name: '更新角色', resource: 'role', action: 'update', scope: 'system' },
  { code: 'role:delete', name: '删除角色', resource: 'role', action: 'delete', scope: 'system' },
  { code: 'role:manage', name: '管理角色', resource: 'role', action: 'manage', scope: 'system' },
  
  // 权限管理
  { code: 'permission:read', name: '查看权限', resource: 'permission', action: 'read', scope: 'system' },
  
  // 租户元数据管理（不包含业务数据）
  { code: 'tenant:create', name: '创建租户', resource: 'tenant', action: 'create', scope: 'system' },
  { code: 'tenant:read', name: '查看租户', resource: 'tenant', action: 'read', scope: 'system' },
  { code: 'tenant:update', name: '更新租户', resource: 'tenant', action: 'update', scope: 'system' },
  { code: 'tenant:delete', name: '删除租户', resource: 'tenant', action: 'delete', scope: 'system' },
  { code: 'tenant:manage', name: '管理租户', resource: 'tenant', action: 'manage', scope: 'system' },
  
  // 订阅管理
  { code: 'subscription:read', name: '查看订阅', resource: 'subscription', action: 'read', scope: 'system' },
  { code: 'subscription:manage', name: '管理订阅', resource: 'subscription', action: 'manage', scope: 'system' },
  
  // 审计日志
  { code: 'audit:read', name: '查看审计日志', resource: 'audit', action: 'read', scope: 'system' },
  
  // 紧急访问
  { code: 'emergency:request', name: '申请紧急访问', resource: 'emergency', action: 'request', scope: 'system' },
  { code: 'emergency:approve', name: '审批紧急访问', resource: 'emergency', action: 'approve', scope: 'system' },
  
  // ========== 租户业务权限 (Tenant Scope) ==========
  // 成员管理
  { code: 'member:create', name: '添加成员', resource: 'member', action: 'create', scope: 'tenant' },
  { code: 'member:read', name: '查看成员', resource: 'member', action: 'read', scope: 'tenant' },
  { code: 'member:update', name: '更新成员', resource: 'member', action: 'update', scope: 'tenant' },
  { code: 'member:delete', name: '删除成员', resource: 'member', action: 'delete', scope: 'tenant' },
  { code: 'member:manage', name: '管理成员', resource: 'member', action: 'manage', scope: 'tenant' },
  
  // HubSpot 功能
  { code: 'hubspot:read', name: '查看HubSpot数据', resource: 'hubspot', action: 'read', scope: 'tenant' },
  { code: 'hubspot:create', name: '创建HubSpot数据', resource: 'hubspot', action: 'create', scope: 'tenant' },
  { code: 'hubspot:update', name: '更新HubSpot数据', resource: 'hubspot', action: 'update', scope: 'tenant' },
  { code: 'hubspot:sync', name: '同步HubSpot数据', resource: 'hubspot', action: 'sync', scope: 'tenant' },
  { code: 'hubspot:manage', name: '管理HubSpot', resource: 'hubspot', action: 'manage', scope: 'tenant' },
  
  // LINE 功能
  { code: 'line:read', name: '查看LINE消息', resource: 'line', action: 'read', scope: 'tenant' },
  { code: 'line:send', name: '发送LINE消息', resource: 'line', action: 'send', scope: 'tenant' },
  { code: 'line:manage', name: '管理LINE', resource: 'line', action: 'manage', scope: 'tenant' },
  
  // 对话记录
  { code: 'conversation:read', name: '查看对话记录', resource: 'conversation', action: 'read', scope: 'tenant' },
  
  // 租户角色管理
  { code: 'tenant_role:create', name: '创建租户角色', resource: 'tenant_role', action: 'create', scope: 'tenant' },
  { code: 'tenant_role:read', name: '查看租户角色', resource: 'tenant_role', action: 'read', scope: 'tenant' },
  { code: 'tenant_role:update', name: '更新租户角色', resource: 'tenant_role', action: 'update', scope: 'tenant' },
  { code: 'tenant_role:delete', name: '删除租户角色', resource: 'tenant_role', action: 'delete', scope: 'tenant' },
  { code: 'tenant_role:manage', name: '管理租户角色', resource: 'tenant_role', action: 'manage', scope: 'tenant' },
];

// 系统级角色定义
const systemRoles = [
  {
    code: 'super_admin',
    name: '超级管理员',
    description: '拥有所有系统权限，可申请紧急访问租户数据',
    type: 'system',
    isSystem: true,
    permissions: [
      'user:manage', 'role:manage', 'permission:read',
      'tenant:manage', 'subscription:manage', 'audit:read',
      'emergency:request', 'emergency:approve',
    ],
  },
  {
    code: 'admin',
    name: '系统管理员',
    description: '管理用户和租户元数据，不能访问租户业务数据',
    type: 'system',
    isSystem: true,
    permissions: [
      'user:read', 'user:update', 'user:delete',
      'role:read', 'permission:read',
      'tenant:read', 'tenant:update',
      'subscription:read', 'audit:read',
    ],
  },
  {
    code: 'user',
    name: '普通用户',
    description: '基础用户，无系统管理权限，可加入租户',
    type: 'system',
    isSystem: true,
    permissions: [],
  },
];

// 租户级角色定义
const tenantRoles = [
  {
    code: 'tenant_owner',
    name: '租户所有者',
    description: '租户的创建者，拥有租户内的全部权限',
    type: 'tenant',
    isSystem: true,
    permissions: [
      'member:manage', 'hubspot:manage', 'line:manage',
      'conversation:read', 'tenant_role:manage',
    ],
  },
  {
    code: 'tenant_admin',
    name: '租户管理员',
    description: '租户管理员，可以管理成员和业务数据',
    type: 'tenant',
    isSystem: true,
    permissions: [
      'member:read', 'member:update', 'member:create',
      'hubspot:manage', 'line:manage', 'conversation:read',
      'tenant_role:read',
    ],
  },
  {
    code: 'tenant_member',
    name: '租户成员',
    description: '普通成员，只读访问业务数据',
    type: 'tenant',
    isSystem: true,
    permissions: [
      'member:read', 'hubspot:read', 'line:read', 'conversation:read',
    ],
  },
];

async function main() {
  console.log('🌱 开始播种数据...');

  // 1. 创建权限
  console.log('📝 创建权限...');
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        name: perm.name,
        resource: perm.resource,
        action: perm.action,
        scope: perm.scope,
      },
      create: perm,
    });
  }
  console.log(`✅ 创建了 ${permissions.length} 个权限`);

  // 2. 创建系统级角色
  console.log('📝 创建系统级角色...');
  for (const role of systemRoles) {
    const { permissions: permCodes, ...roleData } = role;
    
    const createdRole = await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: roleData.name,
        description: roleData.description,
        type: roleData.type,
        isSystem: roleData.isSystem,
      },
      create: roleData,
    });

    // 分配权限
    if (permCodes.length > 0) {
      // 先删除现有权限关联
      await prisma.rolePermission.deleteMany({
        where: { roleId: createdRole.id },
      });

      // 创建新的权限关联
      for (const permCode of permCodes) {
        const perm = await prisma.permission.findUnique({
          where: { code: permCode },
        });
        if (perm) {
          await prisma.rolePermission.create({
            data: {
              roleId: createdRole.id,
              permissionId: perm.id,
            },
          });
        }
      }
    }
  }
  console.log(`✅ 创建了 ${systemRoles.length} 个系统级角色`);

  // 3. 创建租户级角色
  console.log('📝 创建租户级角色...');
  for (const role of tenantRoles) {
    const { permissions: permCodes, ...roleData } = role;
    
    const createdRole = await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: roleData.name,
        description: roleData.description,
        type: roleData.type,
        isSystem: roleData.isSystem,
      },
      create: roleData,
    });

    // 分配权限
    if (permCodes.length > 0) {
      // 先删除现有权限关联
      await prisma.rolePermission.deleteMany({
        where: { roleId: createdRole.id },
      });

      // 创建新的权限关联
      for (const permCode of permCodes) {
        const perm = await prisma.permission.findUnique({
          where: { code: permCode },
        });
        if (perm) {
          await prisma.rolePermission.create({
            data: {
              roleId: createdRole.id,
              permissionId: perm.id,
            },
          });
        }
      }
    }
  }
  console.log(`✅ 创建了 ${tenantRoles.length} 个租户级角色`);

  console.log('🎉 数据播种完成！');
}

main()
  .catch((e) => {
    console.error('❌ 数据播种失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

