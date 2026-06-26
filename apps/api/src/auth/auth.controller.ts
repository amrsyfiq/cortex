import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import {
  type AuthResponse,
  type AuthTokens,
  type LoginInput,
  type RegisterInput,
  authResponseSchema,
  loginSchema,
  registerSchema,
} from '@saas/contracts';
import { zodBody, zodResponse } from '../common/swagger/zod-openapi';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import type { AuthenticatedUser, AuthenticatedUserWithRefreshToken } from './auth.types';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

/**
 * Thin HTTP layer over AuthService. Each method:
 *   - declares its route + status code,
 *   - validates the body with the SHARED Zod schema via ZodValidationPipe,
 *   - delegates all real work to the service.
 *
 * Notice there's almost no logic here — that's the point of the controller/
 * service split.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  // Body + response shapes come straight from the shared Zod schemas — defined
  // once in @saas/contracts, used for validation AND these docs.
  @ApiBody(zodBody(registerSchema, { name: 'Carol New', email: 'carol@example.com', password: 'password123' }))
  @ApiOkResponse(zodResponse(authResponseSchema, 'The new user and a fresh token pair'))
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Public()
  @HttpCode(HttpStatus.OK) // POST defaults to 201; a login isn't a creation.
  @Post('login')
  @ApiBody(zodBody(loginSchema, { email: 'alice@example.com', password: 'password123' }))
  @ApiOkResponse(zodResponse(authResponseSchema, 'The user and a fresh token pair'))
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  /**
   * Protected by the REFRESH guard (not the global access guard). The client
   * sends its refresh token as the Bearer token here.
   */
  @Public() // opt out of the GLOBAL access guard...
  @UseGuards(JwtRefreshGuard) // ...and use the refresh guard instead.
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@CurrentUser() user: AuthenticatedUserWithRefreshToken): Promise<AuthTokens> {
    return this.auth.refresh(user.id, user.refreshToken);
  }

  /** Requires a valid ACCESS token (the global guard). Revokes the session. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logout(user.id);
  }
}
