import { z } from 'zod';
import { emailSchema, passwordSchema } from './common';
import { publicUserSchema } from './user';

/**
 * Auth request/response contracts.
 *
 * These are the bodies the web app sends to /auth/* and the responses it gets
 * back. The API validates incoming requests against the *input* schemas via a
 * Zod validation pipe, so a malformed body is rejected before it reaches any
 * business logic.
 */

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * The token pair returned by login/register/refresh.
 *  - accessToken: short-lived (minutes). Sent on every API call. If stolen,
 *    it expires fast.
 *  - refreshToken: long-lived (days). Used ONLY to mint new access tokens.
 *    Stored hashed in the DB so a leak can be revoked.
 */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/** Full auth response: who you are + your fresh tokens. */
export const authResponseSchema = z.object({
  user: publicUserSchema,
  tokens: authTokensSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
