import { z } from 'zod';

/**
 * Schema for the environment variables this service needs. We validate process.env
 * at boot so the app fails LOUDLY and immediately if (say) DATABASE_URL is missing,
 * instead of mysteriously crashing on the first DB query in production.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  // The AI assistant's key (Google Gemini, via its OpenAI-compatible endpoint).
  // OPTIONAL on purpose: the app boots fine without it, and only the /assistant
  // routes fail (with a clear message) until it's set.
  // Get a FREE key at https://aistudio.google.com/apikey
  //
  // We preprocess '' → undefined first: in dev an unset key means the line is
  // absent (undefined), but under Docker Compose an unset var arrives as an
  // empty STRING, which would otherwise fail .min(1). Treat '' as "not set".
  GEMINI_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to NestJS's ConfigModule as `validate`. Nest calls it with raw
 * process.env; we parse and return the typed, defaulted result. A throw here
 * aborts startup.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
