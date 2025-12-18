import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { SharedModule } from '../../shared/shared.module';
import { RateLimiterModule } from 'nestjs-rate-limiter';

@Module({
  imports: [
    SharedModule,
    RateLimiterModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
