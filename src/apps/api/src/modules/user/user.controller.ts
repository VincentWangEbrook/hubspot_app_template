import { Controller, Post, Body, Req, Res, Get, UseGuards, UnauthorizedException} from '@nestjs/common';
import { UserService } from './user.service';
import { LoginDto } from './dto/login.dto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimiterGuard, RateLimit } from 'nestjs-rate-limiter';
import * as bcrypt from 'bcrypt';

@Controller('api/auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @UseGuards(RateLimiterGuard)
  @RateLimit({
    points: 3,
    duration: 60,
    errorMessage: '注册请求过于频繁，请稍后再试。',
  })
  async register(
    @Body() body: { email: string; password: string; username: string},
    @Res() res: FastifyReply,
  ) {
    const user = await this.userService.register(body.email, body.password, body.username);
    return res.send({ success: true, data: user });
  }

  @Post('login')
  @UseGuards(RateLimiterGuard) // 启用限流
  @RateLimit({
    points: 5, // 1分钟内最多5次尝试
    duration: 60,
    errorMessage: '登录尝试太频繁，请 1 分钟后再试。',
  })
  async login(
    @Body() loginDto: LoginDto, // 用 DTO 校验输入
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply
  ) {
      const { user: safeUser } = await this.userService.login(
        loginDto.email,
        loginDto.password
      );

      // 初始化 Session：添加用户信息 + lastActiveTime（供过期中间件校验）
      req.session.user = {
        id: safeUser.id,
        username: safeUser.username,
        email: safeUser.email,
        lastActiveTime: Date.now(), // 关键：初始化最后活跃时间
      };

      // 同步 Session 的 Cookie 过期时间（fastify-session 会自动同步到 Redis）
      req.session.cookie.maxAge = 2 * 60 * 60 * 1000; // 2小时（毫秒）

      // 设置 HttpOnly Cookie
      // res.setCookie('token', token, {
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV === 'production',
      //   sameSite: 'lax',
      //   path: '/',
      //   maxAge: 7 * 24 * 60 * 60, // 一周
      // });

      // 保存 Session（触发 Redis 存储 + 过期时间设置）
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          resolve(null);
        });
      });

      return res.send({ success: true , data: { user: safeUser } });
  }

  @Get('me')
  async getCurrentUser(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return { success: false, message: '未登录' };
    }
    const user = await this.userService.findOneById(sessionUser.id);

    return res.send({ success: true, data: { user } });
  }

  @Post('logout')
  async logout(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    await req.session.destroy();
    res.clearCookie('sessionId');
    return res.send({ success: true, message: '已登出' });
  }

  @Post('update-password')
  async updatePassword(
    @Req() req: any,
    @Body() body: { oldPassword: string; newPassword: string },
    @Res() res: FastifyReply
  ) {
    const sessionUser = req.session.user;
    if (!sessionUser) {
      return res.send({ success: false, message: '未登录' });
    }

    await this.userService.findOneById(sessionUser.id);

    const match = await bcrypt.compare(body.oldPassword, body.newPassword);
    if (!match) throw new UnauthorizedException('旧密码错误');

    const hashedNewPassword = await bcrypt.hash(body.newPassword, 10);

    await this.userService.updatePassword(sessionUser.id, hashedNewPassword);

    return res.send({ success: true, message: '密码修改成功' });
  }

  @Post('update-profile')
  async UpdateProfile(@Req() req: FastifyRequest, @Body() body: { username: string; }, @Res() res: FastifyReply) {
    const sessionUser = req.session.user;
    if (!sessionUser) {
      return res.send({ success: false, message: '未登录' });
    }
    const user = await this.userService.findOneById(sessionUser.id);

    const newUser = await this.userService.update(user.id, body.username);

    return res.send({success: true, message: '更新成功', data: { user: newUser } });
  }
}
