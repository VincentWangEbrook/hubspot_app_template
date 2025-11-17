import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserEntity } from './entities/user.entity';
import { UserController } from './user.controller';
import { SharedModule } from '../../shared/shared.module';
import { RateLimiterModule } from 'nestjs-rate-limiter';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    SharedModule,
    RateLimiterModule
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
