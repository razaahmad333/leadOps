import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@leadops/shared';

/**
 * Extracts the authenticated user from the request.
 * Usage: @CurrentUser() user: AuthUser
 * Requires JwtAuthGuard to be applied first.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
