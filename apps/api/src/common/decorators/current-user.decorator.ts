import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/auth.types';

/**
 * Lets a controller method ask for the logged-in user directly:
 *
 *   @Get('me')
 *   me(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * The user object is placed on `request.user` by Passport after the JWT
 * strategy validates the token. This decorator just pulls it off the request so
 * controllers don't have to touch the raw request object.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
