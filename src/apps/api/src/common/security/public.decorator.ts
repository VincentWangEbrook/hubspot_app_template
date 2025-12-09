import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './session.guard';

/**
 * Public decorator
 * Mark routes that don't require authentication
 * 
 * @example
 * ```typescript
 * @Public()
 * @Get('public-endpoint')
 * async publicEndpoint() {
 *   return { message: 'This endpoint is public' };
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
