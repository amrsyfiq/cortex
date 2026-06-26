import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../config/env.validation';
import type { AuthenticatedUser, JwtPayload } from '../auth.types';

/**
 * Validates ACCESS tokens. Passport calls this for routes protected by
 * JwtAuthGuard. It:
 *   1. pulls the token from the `Authorization: Bearer <token>` header,
 *   2. verifies the signature + expiry against JWT_ACCESS_SECRET,
 *   3. hands the decoded payload to `validate()`, whose return value becomes
 *      `request.user`.
 *
 * The strategy NAME is 'jwt' (the default), which the guard references.
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  // Runs only AFTER the signature/expiry checks pass. Shape `request.user`.
  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email };
  }
}
