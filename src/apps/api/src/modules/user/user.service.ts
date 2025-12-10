import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { SafeUser } from './types/user.types';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PermissionService } from '../role/permission.service';

// 扩展 SafeUser 类型，包含 permissions
export interface SafeUserWithPermissions extends SafeUser {
  permissions: string[];
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly permissionService: PermissionService,
  ) {}

  async register(email: string, password: string, username: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('邮箱已注册');

    const hash = await bcrypt.hash(password, 10);
    const total = await this.prisma.user.count();
    const autoAdmin = (this.config.get<string>('AUTO_ADMIN_FIRST_USER') ?? 'true').toLowerCase() === 'true';
    const adminEmailsCsv = (this.config.get<string>('INITIAL_ADMIN_EMAILS') || '').toLowerCase();
    const adminEmailList = adminEmailsCsv
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    let initialRole: 'admin' | 'user' = 'user';
    if ((autoAdmin && total === 0) || adminEmailList.includes(email.toLowerCase())) {
      initialRole = 'admin';
    }
    
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hash,
        username: username,
        userRoles: {
          create: {
            role: {
              connect: { code: initialRole },
            },
          },
        },
      }
    });

    //const token = this.jwtService.sign({ sub: user.id, email, role: user.role });
    const { password: _omit, ...safeUser } = user;
    return { user: safeUser };
  }

  async login(email: string, password: string): Promise<{ user: SafeUserWithPermissions; }> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) throw new UnauthorizedException('账号或密码错误');

      const match = await bcrypt.compare(password, user.password);
      if (!match) throw new UnauthorizedException('账号或密码错误');

      // 获取用户的系统权限
      const permissions = await this.permissionService.getUserPermissions(user.id);

      // 解构过滤密码，返回带 permissions 的用户信息
      const { password: _, ...safeUser } = user;
      return { 
        user: {
          ...safeUser,
          permissions,
        }
      };

    } catch (error) {
      console.error('用户登录失败:', error);
      throw new UnauthorizedException('账号或密码错误');
    }
  }

  async updatePassword(userId: string, password: string) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { password },
    });
  }

  verifyJwt(token: string) {
    return this.jwtService.verify(token);
  }

  async update(userId: string, username: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { username },
    });

    const { password: _omit, ...safeUser } = updated;

    return safeUser;
  }

  async findOneById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    const { password: _omit, ...safeUser } = user;

    // 获取用户的系统权限
    const permissions = await this.permissionService.getUserPermissions(user.id);
    return {
      ...safeUser,
      permissions,
    };
  }

  async deleteUser(userId: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    // Due to the foreign key constraint with RESTRICT on createdTenants,
    // we might want to check if they own any tenants and handle it.
    // For now, we'll let Prisma throw the error if they do, or we could explicitly check.
    // If the requirement is to prevent deletion if they own tenants, the DB constraint does that.
    
    // If we want to allow deletion even if they own tenants (by deleting tenants), 
    // we would need to delete tenants first or change FK to CASCADE.
    // Assuming RESTRICT behavior (safe default), so this will fail if they have created tenants.
    
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * 创建密码重置令牌并发送邮件
   * @param email 用户邮箱
   * @returns 始终返回成功（防止枚举攻击）
   */
  async createPasswordResetToken(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // 用户不存在时静默返回，防止枚举攻击
      return;
    }

    // 生成安全的随机 token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分钟后过期

    // 删除该用户之前的未使用 token
    await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    });

    // 创建新的重置 token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // 发送重置邮件
    await this.emailService.sendPasswordResetEmail(email, token);
  }

  /**
   * 验证重置令牌是否有效
   * @param token 重置令牌
   * @returns 验证结果
   */
  async verifyResetToken(token: string): Promise<{ valid: boolean; message: string }> {
    if (!token) {
      return { valid: false, message: '缺少重置令牌' };
    }

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return { valid: false, message: '重置链接无效' };
    }

    if (resetToken.used) {
      return { valid: false, message: '此重置链接已被使用' };
    }

    if (new Date() > resetToken.expiresAt) {
      return { valid: false, message: '重置链接已过期' };
    }

    return { valid: true, message: '令牌有效' };
  }

  /**
   * 使用令牌重置密码
   * @param token 重置令牌
   * @param newPassword 新密码
   */
  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    // 验证密码格式
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('密码至少需要6个字符');
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      throw new BadRequestException('密码需同时包含字母和数字');
    }

    // 查找有效的 token
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('重置链接无效或已过期');
    }

    if (resetToken.used) {
      throw new BadRequestException('此重置链接已被使用');
    }
console.log(resetToken.expiresAt);
console.log(new Date());
    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('重置链接已过期，请重新申请');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);
  }
}
