import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError } from '@saas/contracts';

/**
 * One filter to rule all errors. Registered globally in main.ts, it catches
 * EVERY exception thrown anywhere in the request lifecycle and converts it into
 * the single, predictable `ApiError` body defined in @saas/contracts.
 *
 * Two big wins:
 *  1. The frontend handles exactly one error shape, never a surprise HTML page.
 *  2. We control what leaks. Unexpected (non-HttpException) errors are logged
 *     with their stack server-side, but the client only gets a generic 500 —
 *     stack traces never go over the wire.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';
    let details: ApiError['details'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      error = exception.constructor.name.replace(/Exception$/, '');

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = typeof b.message === 'string' ? b.message : message;
        // Our ZodValidationPipe attaches field-level `details`.
        if (b.details && typeof b.details === 'object') {
          details = b.details as ApiError['details'];
        }
      }
    } else {
      // Truly unexpected: log the full error server-side, hide it from clients.
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload: ApiError = { statusCode: status, message, error, details };
    response.status(status).json(payload);
  }
}
