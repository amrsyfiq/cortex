import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../config/env.validation';
import type { AuthenticatedUserWithRefreshToken, JwtPayload } from '../auth.types';

/**
 * Validates REFRESH tokens (used only by POST /auth/refresh). It's a SEPARATE
 * strategy named 'jwt-refresh' with its own secret, so an access token can
 * never be used to refresh and vice-versa.
 *
 * `passReqToCallback: true` gives validate() the raw request so we can pull the
 * actual token string back out and forward it to the service, which compares it
 * against the hash stored in the DB (that's the rotation/revocation check).
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_REFRESH_SECRET', { infer: true }),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): AuthenticatedUserWithRefreshToken {
    const header = req.get('authorization') ?? '';
    const refreshToken = header.replace('Bearer', '').trim();
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token malformed');
    }
    return { id: payload.sub, email: payload.email, refreshToken };
  }
}
