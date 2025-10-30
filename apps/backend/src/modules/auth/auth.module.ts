import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TenantModule } from '../tenant/tenant.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule, HttpModule, TenantModule],
  controllers: [AuthController],
  providers: [AuthService, JwtService],
  exports: [AuthService],
})
export class AuthModule {}
