import Redis from 'ioredis';
import { RateLimiterOptions } from 'nestjs-rate-limiter';

const redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

export const rateLimiterOptions: RateLimiterOptions = {
    points: 10, // 默认每个 IP 每分钟允许 10 次请求
    duration: 60, // 时间窗口：60 秒
    errorMessage: '请求太频繁，请稍后再试。',
    keyPrefix: 'rate-limit',
    storeClient: redisClient, // 使用 Redis 存储（可选）
};
