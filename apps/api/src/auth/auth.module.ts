import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

/**
 * Wires the auth feature together:
 *  - PassportModule + JwtModule provide the token machinery.
 *  - UsersModule is imported so AuthService can inject UsersService.
 *  - Both strategies are providers so Passport can discover them.
 *
 * JwtModule is registered with no global secret on purpose — we pass the
 * correct secret per-token in AuthService (access vs refresh use different ones).
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), UsersModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy],
})
export class AuthModule {}
