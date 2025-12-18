/**
 * 数据迁移脚本
 * 将现有的硬编码角色迁移到新的 RBAC 系统
 * 
 * 运行方式: npx ts-node prisma/migrate-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 旧角色到新角色的映射
const userRoleMapping: Record<string, string> = {
  'admin': 'admin',
  'user': 'user',
};

const tenantMemberRoleMapping: Record<string, string> = {
  'owner': 'tenant_owner',
  'admin': 'tenant_admin',
  'member': 'tenant_member',
};

async function migrateUserRoles() {
  console.log('📦 开始迁移用户角色...');

  // 获取所有角色
  const roles = await prisma.role.findMany({
    where: { type: 'system' },
  });
  const roleMap = new Map(roles.map(r => [r.code, r.id]));

  // 查询 users 表中的 role 字段（如果存在）
  // 注意：由于我们已经从 schema 中移除了 role 字段，需要使用原始 SQL
  const users = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
    SELECT id, role FROM users WHERE role IS NOT NULL
  `.catch(() => []);

  let migratedCount = 0;
  for (const user of users) {
    const newRoleCode = userRoleMapping[user.role] || 'user';
    const roleId = roleMap.get(newRoleCode);

    if (roleId) {
      // 检查是否已有此角色
      const existing = await prisma.userRole.findUnique({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: roleId,
          },
        },
      });

      if (!existing) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: roleId,
          },
        });
        migratedCount++;
      }
    }
  }

  console.log(`✅ 迁移了 ${migratedCount} 个用户角色`);
}

async function migrateTenantMemberRoles() {
  console.log('📦 开始迁移租户成员角色...');

  // 获取所有租户级角色
  const roles = await prisma.role.findMany({
    where: { type: 'tenant' },
  });
  const roleMap = new Map(roles.map(r => [r.code, r.id]));

  // 查询 tenant_members 表中的旧 role 字段
  const members = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
    SELECT id, role FROM tenant_members WHERE role IS NOT NULL AND role_id IS NULL
  `.catch(() => []);

  let migratedCount = 0;
  for (const member of members) {
    const newRoleCode = tenantMemberRoleMapping[member.role] || 'tenant_member';
    const roleId = roleMap.get(newRoleCode);

    if (roleId) {
      await prisma.$executeRaw`
        UPDATE tenant_members SET role_id = ${roleId}::uuid WHERE id = ${member.id}::uuid
      `;
      migratedCount++;
    }
  }

  console.log(`✅ 迁移了 ${migratedCount} 个租户成员角色`);
}

async function assignDefaultRoleToNewUsers() {
  console.log('📦 为无角色用户分配默认角色...');

  // 获取 'user' 角色 ID
  const userRole = await prisma.role.findUnique({
    where: { code: 'user' },
  });

  if (!userRole) {
    console.log('⚠️ 找不到 user 角色，请先运行 seed');
    return;
  }

  // 查找没有任何角色的用户
  const usersWithoutRole = await prisma.user.findMany({
    where: {
      userRoles: {
        none: {},
      },
    },
  });

  let assignedCount = 0;
  for (const user of usersWithoutRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: userRole.id,
      },
    });
    assignedCount++;
  }

  console.log(`✅ 为 ${assignedCount} 个用户分配了默认角色`);
}

async function main() {
  console.log('🚀 开始数据迁移...\n');

  try {
    // 1. 迁移用户角色
    await migrateUserRoles();

    // 2. 迁移租户成员角色
    await migrateTenantMemberRoles();

    // 3. 为无角色用户分配默认角色
    await assignDefaultRoleToNewUsers();

    console.log('\n🎉 数据迁移完成！');
  } catch (error) {
    console.error('\n❌ 数据迁移失败:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

