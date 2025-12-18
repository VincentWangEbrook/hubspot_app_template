/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

/**
 * 获取当前用户 ID（由 TenantMemberGuard 注入）
 * 
 * @example
 * ```typescript
 * @Post('messages')
 * async sendMessage(@UserId() userId: string, @Body() body: SendMessageDto) {
 *   body.userId = userId;
 *   // ...
 * }
 * ```
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return request.userId!;
  },
);

/**
 * 获取当前租户 ID（由 TenantMemberGuard 注入）
 * 
 * @example
 * ```typescript
 * @Get('data')
 * async getData(@TenantId() tenantId: string) {
 *   return this.service.getData(tenantId);
 * }
 * ```
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return request.tenantId!;
  },
);

/**
 * 获取当前用户信息（包含 userId 和 tenantId）
 * 
 * @example
 * ```typescript
 * @Post('action')
 * async doAction(@CurrentUser() user: { userId: string; tenantId: string }) {
 *   console.log(user.userId, user.tenantId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): { userId: string; tenantId: string } => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return {
      userId: request.userId!,
      tenantId: request.tenantId!,
    };
  },
);
