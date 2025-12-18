import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const readlineSync = require('readline-sync');

const prisma = new PrismaClient();

// 密码强度验证规则
interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  
  // 最小长度 8 位
  if (password.length < 8) {
    errors.push('密码长度至少 8 位');
  }
  
  // 最大长度 32 位
  if (password.length > 32) {
    errors.push('密码长度不能超过 32 位');
  }
  
  // 必须包含大写字母
  if (!/[A-Z]/.test(password)) {
    errors.push('必须包含至少一个大写字母');
  }
  
  // 必须包含小写字母
  if (!/[a-z]/.test(password)) {
    errors.push('必须包含至少一个小写字母');
  }
  
  // 必须包含数字
  if (!/[0-9]/.test(password)) {
    errors.push('必须包含至少一个数字');
  }
  
  // 必须包含特殊字符
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('必须包含至少一个特殊字符 (!@#$%^&*等)');
  }
  
  // 不能包含空格
  if (/\s/.test(password)) {
    errors.push('不能包含空格');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 验证邮箱格式
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function createAdmin() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║        创建系统用户工具                 ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 获取可用角色
  const availableRoles = await prisma.role.findMany({
    where: { type: 'system' },
    orderBy: { code: 'asc' },
  });

  if (availableRoles.length === 0) {
    console.error('❌ 没有可用的系统角色，请先运行 npm run db:seed');
    await prisma.$disconnect();
    process.exit(1);
  }

  // 步骤 1: 输入邮箱
  let email = '';
  while (!email) {
    email = readlineSync.question('📧 请输入邮箱: ').trim().toLowerCase();
    if (!validateEmail(email)) {
      console.log('❌ 邮箱格式不正确，请重新输入\n');
      email = '';
    }
  }

  // 检查用户是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  let userId: string;
  let username: string;
  let isNewUser = false;

  if (existingUser) {
    // 用户已存在，显示信息并询问是否只分配角色
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║        用户已存在                       ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ 邮箱:   ${existingUser.email.padEnd(29)} ║`);
    console.log(`║ 用户名: ${(existingUser.username || '未设置').padEnd(29)} ║`);
    console.log('╚════════════════════════════════════════╝');
    
    if (existingUser.userRoles.length > 0) {
      console.log('\n当前角色:');
      existingUser.userRoles.forEach(ur => {
        console.log(`   • ${ur.role.name} (${ur.role.code})`);
      });
    } else {
      console.log('\n当前没有分配任何角色');
    }
    
    const continueAssign = readlineSync.keyInYNStrict('\n是否为该用户分配新角色?');
    if (!continueAssign) {
      console.log('\n已取消操作');
      await prisma.$disconnect();
      process.exit(0);
    }
    
    userId = existingUser.id;
    username = existingUser.username || '';
  } else {
    // 新用户，继续收集信息
    isNewUser = true;
    
    // 步骤 2: 输入用户名
    const defaultUsername = email.split('@')[0];
    const usernameInput = readlineSync.question(`👤 请输入用户名 (直接回车使用: ${defaultUsername}): `).trim();
    username = usernameInput || defaultUsername;

    // 步骤 3: 输入密码（隐藏显示）
    console.log('\n📋 密码规则:');
    console.log('   • 长度 8-32 位');
    console.log('   • 包含大写字母 (A-Z)');
    console.log('   • 包含小写字母 (a-z)');
    console.log('   • 包含数字 (0-9)');
    console.log('   • 包含特殊字符 (!@#$%^&*等)\n');

    let password = '';
    while (!password) {
      password = readlineSync.question('🔑 请输入密码: ', { hideEchoBack: true, mask: '*' });
      
      const validation = validatePassword(password);
      if (!validation.isValid) {
        console.log('\n❌ 密码不符合要求:');
        validation.errors.forEach(err => console.log(`   • ${err}`));
        console.log('');
        password = '';
      }
    }

    // 步骤 4: 确认密码
    let confirmPassword = '';
    while (confirmPassword !== password) {
      confirmPassword = readlineSync.question('🔑 请再次输入密码: ', { hideEchoBack: true, mask: '*' });
      if (confirmPassword !== password) {
        console.log('❌ 两次密码输入不一致，请重新输入确认密码\n');
      }
    }

    // 创建用户
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
      },
    });
    console.log(`\n✅ 创建用户成功: ${email}`);
    userId = user.id;
  }

  // 步骤 5: 选择角色
  console.log('\n📋 可用角色:');
  availableRoles.forEach((role, index) => {
    // 检查用户是否已有此角色
    const hasRole = existingUser?.userRoles.some(ur => ur.role.id === role.id);
    const marker = hasRole ? ' [已拥有]' : '';
    console.log(`   ${index + 1}. ${role.code} - ${role.name}${marker}`);
    if (role.description) {
      console.log(`      └─ ${role.description}`);
    }
  });
  
  let roleIndex = -1;
  while (roleIndex < 0 || roleIndex >= availableRoles.length) {
    const roleIndexStr = readlineSync.question('\n请选择角色编号: ');
    roleIndex = parseInt(roleIndexStr, 10) - 1;
    if (isNaN(roleIndex) || roleIndex < 0 || roleIndex >= availableRoles.length) {
      console.log('❌ 无效的角色编号，请重新选择');
      roleIndex = -1;
    }
  }

  const selectedRole = availableRoles[roleIndex];

  // 检查是否已有该角色
  const hasThisRole = existingUser?.userRoles.some(ur => ur.role.id === selectedRole.id);
  
  if (hasThisRole) {
    console.log(`\n⚠️  用户已拥有 ${selectedRole.name} 角色，无需重复分配`);
  } else {
    // 确认分配角色
    if (!isNewUser) {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║           确认分配角色                  ║');
      console.log('╠════════════════════════════════════════╣');
      console.log(`║ 用户:   ${email.padEnd(29)} ║`);
      console.log(`║ 角色:   ${selectedRole.name.padEnd(29)} ║`);
      console.log('╚════════════════════════════════════════╝\n');

      const confirm = readlineSync.keyInYNStrict('确认分配角色?');
      if (!confirm) {
        console.log('\n已取消操作');
        await prisma.$disconnect();
        process.exit(0);
      }
    }

    // 分配角色
    await prisma.userRole.create({
      data: {
        userId,
        roleId: selectedRole.id,
      },
    });
    console.log(`✅ 已分配角色: ${selectedRole.name}`);
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║           操作完成                      ║');
  console.log('╚════════════════════════════════════════╝\n');

  await prisma.$disconnect();
}

createAdmin().catch((error) => {
  console.error('发生错误:', error);
  prisma.$disconnect();
  process.exit(1);
});
