import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class SessionExpireMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SessionExpireMiddleware.name);
  private readonly SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2小时（毫秒）

  use(req: FastifyRequest, reply: FastifyReply, next: () => void) {
    // 1. 无 Session（未登录）→ 直接放行
    if (!req.session || !req.session.user.id) { // 假设你用 userId 标识登录状态，根据实际字段调整
      return next();
    }

    const now = Date.now();
    const session = req.session;

    // 2. 首次登录：初始化 lastActiveTime
    if (!session.user.lastActiveTime) {
      session.user.lastActiveTime = now;
      return this.saveSessionAndNext(req, next);
    }

    // 3. 计算时间差：当前时间 - 最后活跃时间
    const timeDiff = now - session.user.lastActiveTime;

    // 4. 过期 → 销毁 Session，返回 401 未授权
    if (timeDiff > this.SESSION_TIMEOUT) {
      this.logger.log(`Session 过期（用户ID: ${session.user.id}）`);
      req.session.destroy((err) => {
        if (err) this.logger.error('Session 销毁失败：', err);
        // 清除 Cookie，并重定向到登录页（或返回 401）
        reply.clearCookie('sessionId').status(401).send({
          success: false,
          message: '登录已过期，请重新登录',
        });
      });
      return;
    }

    // 5. 未过期 → 更新最后活跃时间 + 刷新 Redis 过期时间
    session.user.lastActiveTime = now;
    this.saveSessionAndNext(req, next);
  }

  // 保存 Session（触发 Redis 过期时间刷新）
  private saveSessionAndNext(req: FastifyRequest, next: () => void) {
    req.session.save((err) => {
      if (err) this.logger.error('Session 保存失败：', err);
      next();
    });
  }
}