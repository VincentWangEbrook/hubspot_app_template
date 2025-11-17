import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { SafeUser } from './types/user.types';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string, username: string) {
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

    //const token = this.jwtService.sign({ sub: user.id, email, role: user.role });
    const { password: _omit, ...safeUser } = user as UserEntity;
    return { user: safeUser };
  }

  async login(email: string, password: string): Promise<{ user: SafeUser; }> {
    const user = await this.repo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('账号或密码错误');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('账号或密码错误');

    // 生成 JWT Token（配置过期时间）
    //const token = this.jwtService.sign(
     // { sub: user.id, email, role: user.role },
     // { expiresIn: '7d' }, // 与 Session 过期时间一致
    //);
    
    // 解构过滤密码，返回 SafeUser 类型（无 any 断言）
    const { password: _, ...safeUser } = user;
    return { user: safeUser };
  }

  async updatePassword(userId: string, password: string) {
    return await this.repo.update(userId, { password });
  }

  verifyJwt(token: string) {
    return this.jwtService.verify(token);
  }

  async update(userId: string, username: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    user.username = username;

    const { password: _omit, ...safeUser } = await this.repo.save(user);

    return safeUser;
  }

  async findOneById(userId: string) {
    const user = await this.repo.findOneBy({ id: userId  });
    if (!user) throw new UnauthorizedException('用户不存在');
    const { password: _omit, ...safeUser } = user;
    return safeUser;
  }
}
