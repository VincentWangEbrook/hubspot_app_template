import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string, username?: string) {
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) throw new Error('邮箱已注册');

    const hash = await bcrypt.hash(password, 10);
    const user = this.repo.create({ email, password: hash, username });
    await this.repo.save(user);

    const token = this.jwt.sign({ sub: user.id, email });
    return { user, token };
  }

  async login(email: string, password: string) {
    console.log('ddd');
    const user = await this.repo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('账号或密码错误');
    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('账号或密码错误');
    const token = this.jwt.sign({ sub: user.id, email });
    return { user, token };
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
    return this.jwt.verify(token);
  }
}
