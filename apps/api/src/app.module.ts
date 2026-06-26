import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { validateEnv } from './config/env.validation';
import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

/**
 * The composition root — Nest assembles the whole app from the modules listed
 * here.
 *
 * Two app-wide behaviors are registered with special tokens:
 *  - APP_GUARD: JwtAuthGuard runs on EVERY request (auth by default; opt out
 *    with @Public()).
 *  - APP_INTERCEPTOR: LoggingInterceptor logs every request's timing.
 *
 * Registering them as providers (rather than in main.ts) means they participate
 * in dependency injection — that's how JwtAuthGuard receives its Reflector.
 */
@Module({
  imports: [
    // Loads .env, validates it, and makes ConfigService available everywhere.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AssistantModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
