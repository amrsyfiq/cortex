import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { Env } from './config/env.validation';

/**
 * The entry point. `nest build` compiles this to dist/main.js, and `pnpm dev`
 * runs it in watch mode. Here we apply the cross-cutting settings that must be
 * registered on the app instance (CORS, the global error filter, shutdown
 * hooks) before the server starts listening.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<Env, true>);

  // All routes are served under /api, e.g. /api/auth/login. Keeps the API
  // namespace distinct from any future static/web routes on the same host.
  app.setGlobalPrefix('api');

  // Turn EVERY error into our standard ApiError JSON shape.
  app.useGlobalFilters(new HttpExceptionFilter());

  // Allow the browser-based web app to call us, and to send/receive cookies
  // or the Authorization header.
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });

  // Let Prisma's onModuleDestroy run on SIGINT/SIGTERM so connections close
  // cleanly on shutdown/redeploy.
  app.enableShutdownHooks();

  // Interactive API docs. Nest scans every @Controller/@Get/@Post to build an
  // OpenAPI spec, then serves Swagger UI at /docs (and the raw JSON at
  // /docs-json). .addBearerAuth() adds the "Authorize" button so you can paste a
  // JWT and call protected routes from the browser.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SaaS API')
    .setDescription('Multi-tenant SaaS dashboard API')
    .setVersion('1.0')
    .addBearerAuth() // defines the "bearer" scheme (the Authorize button)
    // ...and require it on every operation, so the UI actually ATTACHES the
    // token to each request. Public routes (login/register) ignore it server-
    // side via @Public(), so a sent-but-unneeded header is harmless.
    .addSecurityRequirements('bearer')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
