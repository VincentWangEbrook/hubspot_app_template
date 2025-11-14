import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyRedis from '@fastify/redis';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import fastifyRawBody from 'fastify-raw-body';
import { Logger, ValidationPipe } from '@nestjs/common';
import fs from 'fs';
import path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

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
    
  const fastifyInstance = adapter.getInstance();

  // 注册 Cookie
  await fastifyInstance.register(fastifyCookie, {
    secret: process.env.SESSION_SECRET || '',
  });

  // 自动选择 session 存储
  let sessionStore: any = undefined;

  try {
    // 尝试注册 Redis
    const redisRegisterPromise = fastifyInstance.register(fastifyRedis, {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      password: process.env.REDIS_PASSWORD || undefined, // 支持无密码
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0, // 默认数据库 0
      connectTimeout: 3000, // 连接超时 3 秒
      commandTimeout: 3000, // 命令超时 3 秒
    });

    // 5 秒超时控制：超过时间未注册成功则 reject
    await Promise.race([
      redisRegisterPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis 注册超时')), 5000)
      ),
    ]);

    // 监听 Redis 连接状态（便于运维监控）
    fastifyInstance.redis.on('connect', () => {
      logger.log('Redis 连接成功');
    });
    fastifyInstance.redis.on('error', (err) => {
      logger.error(`Redis 连接异常：${err.message}`);
    });

    const redisClient = fastifyInstance.redis;
    if (!redisClient) throw new Error('Redis client not available');

    logger.log('Redis available, using Redis session store');

    sessionStore = {
      set: (id: string, session: any, cb: (err?: any) => void) =>
        redisClient.set(id, JSON.stringify(session), 'EX', 2 * 60 * 60, cb),
      get: (id: string, cb: (err: any, session?: any) => void) =>
        redisClient.get(id, (err, data) => cb(err, data ? JSON.parse(data) : undefined)),
      destroy: (id: string, cb: (err?: any) => void) => redisClient.del(id, cb),
    };
  } catch (err) {
    // Redis 不可用，使用文件存储
    const SESSION_DIR = path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

    sessionStore = {
      set: (id: string, session: any, cb: (err?: any) => void) => {
        fs.writeFile(path.join(SESSION_DIR, id + '.json'), JSON.stringify(session), cb);
      },
      get: (id: string, cb: (err: any, session?: any) => void) => {
        const filePath = path.join(SESSION_DIR, id + '.json');
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) return cb(null, undefined);
          try {
            cb(null, JSON.parse(data));
          } catch (e) {
            cb(e);
          }
        });
      },
      destroy: (id: string, cb: (err?: any) => void) => {
        fs.unlink(path.join(SESSION_DIR, id + '.json'), (err) => cb(err));
      },
    };
    logger.warn('Redis not available, fallback to file session store');
  }

  // 注册 Session 插件
  await fastifyInstance.register(fastifySession, {
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
