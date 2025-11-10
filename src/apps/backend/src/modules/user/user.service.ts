import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string, username?: string) {
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) throw new ConflictException('邮箱已注册');

    const hash = await bcrypt.hash(password, 10);
    const total = await this.repo.count();
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
    const user = this.repo.create({ email: email.toLowerCase(), password: hash, username: username, role: initialRole});
    await this.repo.save(user);

    const token = this.jwtService.sign({ sub: user.id, email, role: user.role });
    const { password: _omit, ...safeUser } = user as any;
    return { user: safeUser, token };
  }

  async login(email: string, password: string) {
    const user = await this.repo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('账号或密码错误');
    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('账号或密码错误');
    const token = this.jwtService.sign({ sub: user.id, email, role: user.role });
    const { password: _omit, ...safeUser } = user as any;
    return { user: safeUser, token };
  }

  async logout() {
    return { success: true, message: '已登出（前端删除token）' };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) throw new UnauthorizedException('旧密码错误');
    user.password = await bcrypt.hash(newPassword, 10);
    await this.repo.save(user);
    return { success: true, message: '密码修改成功' };
  }

  verifyJwt(token: string) {
    return this.jwtService.verify(token);
  }

  async update(userId: string, username: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    user.username = username;
    await this.repo.save(user);
    return { success: true, message: '修改成功' };
  }
}
