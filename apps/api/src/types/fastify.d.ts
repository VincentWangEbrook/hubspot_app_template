import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { fastify } from 'fastify';
import Redis from 'ioredis';

declare module '@nestjs/platform-fastify' {
  interface NestFastifyApplication {
    redis: Redis;
  }
}

declare module 'fastify' {
  interface Session {
    user: {
      id: string;
      username: string;
      email: string;
      permissions: string[];
      lastActiveTime: number;
    };
  }
  interface FastifyRequest {
    userId?: string;
    tenantId?: string;
  }
}
