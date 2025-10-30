import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyRawBody from 'fastify-raw-body';
import { Logger } from '@nestjs/common';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const adapter = new FastifyAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  // 1. 配置 CORS（解决跨域问题，根据环境动态调整）
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl, // 允许前端域名
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // 若需要传递 Cookie 或认证信息
  });

  // 2. 注册 fastify-raw-body 插件（获取原始请求体，用于 webhook）
  await adapter.getInstance().register(fastifyRawBody as any, {
    field: 'rawBody', // 原始请求体将挂载到 request.rawBody
    encoding: 'utf8',
    runFirst: true, // 确保在其他插件前执行
    routes: ['/api/subscription/webhook'], // 仅对 webhook 路由启用
  });

  // 3. 解析并校验端口
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${process.env.PORT}. Must be a number between 1 and 65535.`);
  }

  // 4. 启动服务并输出日志
  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on: http://0.0.0.0:${port}`);
  logger.log(`CORS enabled for: ${frontendUrl}`);
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', err.stack);
  process.exit(1); // 启动失败时退出进程
});