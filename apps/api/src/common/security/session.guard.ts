import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

/**
 * Metadata key for the @Public() decorator
 * Routes marked with @Public() will bypass authentication
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Session-based authentication guard
 * Verifies that the user is logged in by checking the session
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    
    // Check if session exists and has user information
    if (!request.session || !request.session.user || !request.session.user.id) {
      throw new UnauthorizedException('未登录，请先登录');
    }

    // Session is valid, user is authenticated
    return true;
  }
}
