/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { HubSpotModule } from './modules/hubspot/hubspot.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // 动态生成配置文件路径：根据 NODE_ENV 加载 {env}.env
      envFilePath: path.resolve(
        process.cwd(), // 后端项目根目录
        `.env.${process.env.NODE_ENV || 'development'}` // 默认为 development.env
      ),
      isGlobal: true,
      cache: true, // 缓存配置（提升性能）
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      //entities: [Tenant, User],
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // dev only, use migrations in prod
    }),
    TenantModule,
    AuthModule,
    SubscriptionModule,
    HubSpotModule,
    UserModule
  ],
})
export class AppModule {}
