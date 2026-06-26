import { z } from 'zod';

/**
 * Building blocks reused across the other schemas.
 */

/** Every entity in our DB is keyed by a cuid (Prisma's default id strategy). */
export const idSchema = z.string().cuid();

/** Email, normalized to lowercase + trimmed so "Me@X.com " == "me@x.com". */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address');

/**
 * Password policy lives here so the SAME rule guards the signup form (web)
 * and the register endpoint (api). Change it once, both sides update.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters'); // bcrypt truncates >72 bytes

/**
 * A standard, predictable error body. Our API's exception filter returns this
 * shape for every error, so the frontend has exactly one error contract to
 * handle instead of guessing per-endpoint.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  error: z.string(),
  /** Field-level validation errors, keyed by field name, when applicable. */
  details: z.record(z.array(z.string())).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
