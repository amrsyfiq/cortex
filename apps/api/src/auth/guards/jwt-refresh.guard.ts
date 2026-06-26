import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guards POST /auth/refresh with the 'jwt-refresh' strategy. Applied explicitly
 * on that one route (not global), because only the refresh endpoint should
 * accept a refresh token.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
