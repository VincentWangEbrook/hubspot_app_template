import { Controller, Post, Body, Req } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('api/user')
export class UserController {
  constructor(private readonly auth: UserService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; username?: string }) {
    const user = await this.auth.register(body.email, body.password, body.username);
    return { success: true, data: user };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.auth.login(body.email, body.password);
    return { success: true, data: user };
  }

  @Post('logout')
  async logout() {
    return await this.auth.logout();
  }

  @Post('change-password')
  async changePassword(
    @Req() req: any,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user = this.auth.verifyJwt(token);
    return await this.auth.changePassword(user.sub, body.oldPassword, body.newPassword);
  }

  @Post('update')
  async edit(@Req() req: any, @Body() body: { username: string; }) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user = this.auth.verifyJwt(token);
    return await this.auth.update(user.id, body.username);
  }
}
