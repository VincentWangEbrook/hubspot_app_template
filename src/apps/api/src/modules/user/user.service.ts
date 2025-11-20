import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { SafeUser } from './types/user.types';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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
        role: initialRole,
      }
    });

    //const token = this.jwtService.sign({ sub: user.id, email, role: user.role });
    const { password: _omit, ...safeUser } = user;
    return { user: safeUser };
  }

  async login(email: string, password: string): Promise<{ user: SafeUser; }> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) throw new UnauthorizedException('账号或密码错误');

      const match = await bcrypt.compare(password, user.password);
      if (!match) throw new UnauthorizedException('账号或密码错误');

      // 解构过滤密码，返回 SafeUser 类型（无 any 断言）
      const { password: _, ...safeUser } = user;
      return { user: safeUser };

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
    return safeUser;
  }
}
