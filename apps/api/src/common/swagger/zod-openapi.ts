import type { ApiBodyOptions, ApiResponseOptions } from '@nestjs/swagger';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * The Zod→OpenAPI bridge.
 *
 * Our request/response shapes are defined ONCE as Zod schemas in
 * `@saas/contracts`. The Zod validation pipe enforces them at runtime; these
 * helpers feed the SAME schema into the OpenAPI document so Swagger shows the
 * real body/response shape — no hand-maintained @ApiBody duplicate that can
 * drift from the validation truth.
 *
 *   @ApiBody(zodBody(loginSchema, { email: 'alice@example.com', password: '…' }))
 *   @ApiOkResponse(zodResponse(authResponseSchema))
 */

/** Convert a Zod schema to an inline OpenAPI 3.0 schema object. */
export function zodToOpenApi(schema: ZodTypeAny): Record<string, unknown> {
  // target 'openApi3' emits OpenAPI-flavored JSON Schema; $refStrategy 'none'
  // inlines everything so Swagger renders it without external $ref lookups.
  return zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
}

/** Build an @ApiBody() argument from a Zod schema (with an optional example). */
export function zodBody(schema: ZodTypeAny, example?: unknown): ApiBodyOptions {
  const openApiSchema = zodToOpenApi(schema);
  if (example !== undefined) openApiSchema.example = example;
  return { schema: openApiSchema };
}

/** Build an @ApiResponse()/@ApiOkResponse() argument from a Zod schema. */
export function zodResponse(
  schema: ZodTypeAny,
  description?: string,
): ApiResponseOptions {
  return { description, schema: zodToOpenApi(schema) };
}
