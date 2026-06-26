import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * An interceptor wraps the handling of a request — it can run code BEFORE the
 * controller runs and AFTER it produces a response. We use it for structured
 * access logging: method, path, status, and how long the request took.
 *
 * In real systems this is where you'd also attach a request id / trace id for
 * correlating logs across services. Kept simple here to show the mechanism.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - startedAt;
        this.logger.log(`${method} ${url} — ${ms}ms`);
      }),
    );
  }
}
