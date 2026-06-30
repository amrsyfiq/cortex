import { z } from 'zod';
import { idSchema } from './common';
import { publicOrganizationSchema } from './organization';

/**
 * A free-text document (e.g. an adviser's meeting note) as returned to clients.
 * The `embedding` is deliberately NOT exposed — it's an internal search artifact,
 * not something the UI needs.
 */
export const publicDocumentSchema = z.object({
  id: idSchema,
  title: z.string(),
  content: z.string(),
  organization: publicOrganizationSchema,
  createdAt: z.coerce.date(),
});
export type PublicDocument = z.infer<typeof publicDocumentSchema>;
