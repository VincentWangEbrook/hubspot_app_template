import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyRedis from '@fastify/redis';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import fastifyRawBody from 'fastify-raw-body';
import { Logger, ValidationPipe } from '@nestjs/common';
import Redis from 'ioredis';

const logger = new Logger('Bootstrap');

async function bootstrap() {

  // 创建 Fastify 适配器
  const adapter = new FastifyAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  // 注册全局异常过滤器（统一错误响应）
  app.useGlobalFilters(new HttpExceptionFilter());

  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // 自动剔除 DTO 中未声明的属性
    forbidNonWhitelisted: true, // 非白名单字段报错
    transform: true,        // 自动把 JSON 转换成 DTO 类实例
  }));
    
  const fastify = adapter.getInstance();

  // 注册 Cookie
  await fastify.register(fastifyCookie, {
    secret: process.env.SESSION_SECRET || '',
  });

  // 自动选择 session 存储
  let sessionStore: any = undefined;
  try {
    // 尝试注册 Redis
    await fastify.register(fastifyRedis, {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      password: process.env.REDIS_PASSWORD || undefined, // 支持无密码
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0, // 默认数据库 0
      connectTimeout: 3000, // 连接超时 3 秒
      commandTimeout: 3000, // 命令超时 3 秒
    });

    const redis = fastify.redis as Redis;
    await redis.ping();
    logger.log('✅ Redis connected, using Redis session store');

    sessionStore = {
      set: (id: string, session: any, cb: (err?: any) => void) =>
        redis.set(id, JSON.stringify(session), 'EX', 2 * 60 * 60, cb),
      get: (id: string, cb: (err: any, session?: any) => void) =>
        redis.get(id, (err, data) => cb(err, data ? JSON.parse(data) : undefined)),
      destroy: (id: string, cb: (err?: any) => void) => redis.del(id, cb),
    };
  } catch (err) {
    logger.warn('❌ Redis not available, using in-memory session store (not recommended for prod)');
    sessionStore = undefined;
  }

  // 注册 Session 插件
  await fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET || '',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 2, // 2h
    },
    saveUninitialized: false,
    store: sessionStore,
  });

  // 跨域配置（支持 Cookie）
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // 注册 fastify-raw-body（Webhook 场景）
  await adapter.getInstance().register(fastifyRawBody as any, {
    field: 'rawBody',
    encoding: 'utf8',
    runFirst: true,
    routes: ['/api/subscription/webhook'],
  });

  // 启动服务
  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on: http://0.0.0.0:${port}`);
  logger.log(`CORS enabled for: ${frontendUrl}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
