import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TenantModule } from '../tenant/tenant.module';
import { JwtService } from '@nestjs/jwt';
import { Client } from '@hubspot/api-client';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [ConfigModule, HttpModule, TenantModule, SharedModule],
  controllers: [AuthController],
  providers: [AuthService, JwtService, Client],
  exports: [AuthService],
})
export class AuthModule {}
