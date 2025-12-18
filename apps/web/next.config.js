/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,  // 严格模式（推荐开启）
    swcMinify: true,  // 优化构建速度和产物体积
    // 跨域配置（本地开发时请求后端 API 用，生产环境通过 Nginx 转发，无需配置）
    async rewrites() {
      return [
        {
          source: '/api/:path*',  // 本地开发时，前端 /api 路由转发到后端
          destination: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/:path*'
        }
      ];
    }
  };
  
  module.exports = nextConfig;