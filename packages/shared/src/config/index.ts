/**
 * 共享配置：存储全局通用配置（API 基础 URL、超时时间等）
 * 注：开发/生产环境通过环境变量注入，此处为默认值
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || 'http://localhost:3001/api';
export const API_TIMEOUT = 10000; // 默认请求超时时间（10秒）