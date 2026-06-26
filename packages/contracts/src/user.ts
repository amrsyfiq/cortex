import { z } from 'zod';
import { emailSchema, idSchema } from './common';

/**
 * The PUBLIC shape of a user — what the API is allowed to send to clients.
 *
 * Note what's NOT here: `passwordHash`, `hashedRefreshToken`. Those exist in
 * the database (see prisma/schema.prisma) but must never leave the server.
 * Keeping a separate "public" schema is how you avoid accidentally leaking
 * secrets in an API response.
 */
export const publicUserSchema = z.object({
  id: idSchema,
  email: emailSchema,
  name: z.string(),
  createdAt: z.coerce.date(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;
