import { Controller, Post, Body, Req } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('api/user')
export class UserController {
  constructor(private readonly auth: UserService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; username?: string }) {
    return this.auth.register(body.email, body.password, body.username);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  @Post('logout')
  async logout() {
    return this.auth.logout();
  }

  @Post('change-password')
  async changePassword(
    @Req() req: any,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user = this.auth.verifyJwt(token);
    return this.auth.changePassword(user.sub, body.oldPassword, body.newPassword);
  }
}
