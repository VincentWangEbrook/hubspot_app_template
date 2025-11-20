/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { TenantModule } from './modules/tenants/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { HubspotModule } from './modules/hubspot/hubspot.module';
import { LineModule } from './modules/line/line.module';
import { LineSyncModule } from './modules/line-sync/line-sync.module';
import { UserModule } from './modules/user/user.module';
import { RateLimiterModule } from 'nestjs-rate-limiter';
import { rateLimiterOptions } from './rate-limiter.config';
import { SessionExpireMiddleware } from './middlewares/session-expire.middleware';
import { PrismaModule } from './modules/prisma/prisma.module';

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
    PrismaModule,
    TenantModule,
    AuthModule,
    SubscriptionModule,
    HubspotModule,
    LineModule,
    LineSyncModule,
    UserModule,
    RateLimiterModule.register(rateLimiterOptions),
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 注册全局中间件，对所有路由生效
    consumer.apply(SessionExpireMiddleware)
    .exclude(
      '/api/auth/login', // 登录接口
      '/api/auth/register', // 注册接口
    )
    .forRoutes('*');
  }
}
