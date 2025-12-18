# 构建阶段（多阶段构建，减小最终镜像体积）
FROM node:18-alpine AS builder
WORKDIR /app
# 复制 package.json 和 lockfile，缓存依赖
COPY package*.json ./
# 安装所有依赖（包括 devDependencies，用于构建）
RUN npm install
# 复制项目源码
COPY . .
# 构建 NestJS 生产产物（输出到 dist 目录）
RUN npm run build

# 生产阶段（仅保留运行时必需的文件）
FROM node:18-alpine
WORKDIR /app
# 复制构建阶段的产物
COPY --from=builder /app/dist ./dist
# 复制 package.json 和 lockfile，仅安装生产依赖
COPY --from=builder /app/package*.json ./
RUN npm install --production
# 暴露容器内端口（与 docker-compose 中配置一致）
EXPOSE 3001
# 启动命令（运行构建后的入口文件）
CMD ["node", "dist/main.js"]