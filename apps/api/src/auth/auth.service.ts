import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import type { AuthResponse, AuthTokens, LoginInput, RegisterInput } from '@saas/contracts';
import type { Env } from '../config/env.validation';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './auth.types';

/** bcrypt cost factor. 10–12 is the usual production range. */
const BCRYPT_ROUNDS = 12;

/**
 * All authentication business logic. Controllers stay thin and just call these
 * methods. Nothing here touches Express/HTTP — it's pure domain logic, so it
 * could be reused by a CLI, a queue worker, or tests unchanged.
 *
 * Auth model: short-lived ACCESS token + long-lived ROTATING REFRESH token.
 * The refresh token's bcrypt hash is stored on the user row so we can revoke it
 * (logout) and detect reuse.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Create a new account, then immediately log them in (return tokens). */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      // Don't reveal too much, but a 409 on signup is standard and expected.
      throw new ConflictException('An account with that email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    const tokens = await this.issueTokens({ sub: user.id, email: user.email });
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { user: UsersService.toPublic(user), tokens };
  }

  /** Verify credentials and issue a fresh token pair. */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.users.findByEmail(input.email);
    // Use the SAME error whether the email is unknown or the password is wrong,
    // so an attacker can't enumerate which emails have accounts.
    const invalid = new UnauthorizedException('Invalid email or password');
    if (!user) throw invalid;

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw invalid;

    const tokens = await this.issueTokens({ sub: user.id, email: user.email });
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { user: UsersService.toPublic(user), tokens };
  }

  /**
   * Exchange a valid refresh token for a brand-new pair (rotation). We confirm
   * the presented token matches the stored hash; if it doesn't, the session was
   * revoked or the token is forged.
   */
  async refresh(userId: string, presentedRefreshToken: string): Promise<AuthTokens> {
    const user = await this.users.findById(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const matches = await bcrypt.compare(
      this.sha256(presentedRefreshToken),
      user.hashedRefreshToken,
    );
    if (!matches) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const tokens = await this.issueTokens({ sub: user.id, email: user.email });
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  /** Revoke the refresh token so it can't mint new access tokens. */
  async logout(userId: string): Promise<void> {
    await this.users.updateRefreshTokenHash(userId, null);
  }

  // --- internals --------------------------------------------------------

  /** Sign both tokens in parallel with their own secrets + lifetimes. */
  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_TTL', { infer: true }),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  /** Store the HASH of the current refresh token (never the token itself). */
  private async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // SHA-256 FIRST: bcrypt only hashes the first 72 bytes, but a JWT's unique
    // part (iat/exp/signature) lives PAST byte 72 — its prefix is constant per
    // user. Hashing the full token through SHA-256 (a 64-char digest) puts the
    // token's full entropy inside bcrypt's window, so rotation/reuse-detection
    // actually works.
    const hash = await bcrypt.hash(this.sha256(refreshToken), BCRYPT_ROUNDS);
    await this.users.updateRefreshTokenHash(userId, hash);
  }

  /** Condense an arbitrarily long secret to a fixed 64-char digest for bcrypt. */
  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
