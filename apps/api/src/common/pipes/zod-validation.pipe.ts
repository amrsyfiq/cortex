import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * A Nest "pipe" that validates and transforms an incoming value against a Zod
 * schema BEFORE it reaches the controller method.
 *
 * Why this instead of class-validator (Nest's default)?
 *  - We already define our request shapes once in @saas/contracts with Zod.
 *    Reusing those schemas here means the API enforces exactly the same rules
 *    the frontend used to validate the form. One source of truth.
 *
 * Usage (in a controller):
 *   @Post('login')
 *   login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) { ... }
 *
 * On failure it throws BadRequestException with field-level details, which our
 * HttpExceptionFilter formats into the standard ApiError shape.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      // Group messages by field so the client can show errors inline.
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_root';
        (details[key] ??= []).push(issue.message);
      }
      throw new BadRequestException({ message: 'Validation failed', details });
    }
    return result.data;
  }
}
