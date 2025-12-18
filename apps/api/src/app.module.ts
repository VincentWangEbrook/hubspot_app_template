import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import * as path from 'path';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TenantModule } from './modules/tenants/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { HubspotModule } from './modules/hubspot/hubspot.module';
import { ChatModule } from './modules/chat/chat.module';
import { LineModule } from './modules/line/line.module';
import { LineSyncModule } from './modules/line-sync/line-sync.module';
import { UserModule } from './modules/user/user.module';
import { AdminModule } from './modules/admin/admin.module';
import { RoleModule } from './modules/role/role.module';
import { ChannelModule } from './modules/channel/channel.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { RateLimiterModule } from 'nestjs-rate-limiter';
import { rateLimiterOptions } from './rate-limiter.config';
import { SessionExpireMiddleware } from './middlewares/session-expire.middleware';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { SessionGuard } from './common/security/session.guard';
import { CommonSecurityModule } from './common/security/common.module';
import { EmailModule } from './modules/email/email.module';

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
    // 🔒 安全：Rate Limiting - 防止 DoS 攻击和暴力破解
    ThrottlerModule.forRoot([{
      ttl: 60000, // 时间窗口：60秒
      limit: 100, // 每个窗口最多 100 个请求
    }]),
    PrismaModule,
    RedisModule, // 全局 Redis 服务
    EmailModule,
    CommonSecurityModule,
    RoleModule,
    TenantModule,
    AuthModule,
    SubscriptionModule,
    ChannelModule,
    ChatModule,
    HubspotModule,
    LineModule,
    LineSyncModule,
    WebhookModule,
    UserModule,
    AdminModule,
    RateLimiterModule.register(rateLimiterOptions),
  ],
  providers: [
    // Add SessionGuard as global guard
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    // 🔒 安全：添加全局 Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 注册全局中间件，对所有路由生效
    consumer.apply(SessionExpireMiddleware)
    .exclude(
      '/api/auth/login', // 登录接口
      '/api/auth/register', // 注册接口
      '/api/auth/forgot-password', // 忘记密码接口
      '/api/auth/reset-password', // 重置密码接口
      '/api/auth/verify-reset-token', // 验证重置令牌接口
    )
    .forRoutes('*');
  }
}
