import { z } from 'zod';
import { idSchema } from './common';

/**
 * Roles a user can hold WITHIN an organization. This is the heart of the
 * multi-tenant model: the same user can be an OWNER of org A and a MEMBER of
 * org B at the same time. Role is a property of the *membership*, not the user.
 *
 * Order matters: we treat this as a hierarchy (OWNER > ADMIN > MEMBER) when
 * checking "does this user have AT LEAST this role". See the API's role guard.
 */
export const orgRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
export type OrgRole = z.infer<typeof orgRoleSchema>;

/** Numeric rank for "at least" comparisons. Higher = more privileged. */
export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/** A "slug" is the URL-safe org identifier, e.g. acme-inc in /orgs/acme-inc. */
export const orgSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only');

export const publicOrganizationSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: orgSlugSchema,
  createdAt: z.coerce.date(),
});
export type PublicOrganization = z.infer<typeof publicOrganizationSchema>;

/** What a user sees about an org they belong to: the org + their own role. */
export const membershipSummarySchema = z.object({
  organization: publicOrganizationSchema,
  role: orgRoleSchema,
});
export type MembershipSummary = z.infer<typeof membershipSummarySchema>;

/** Input to create a new organization. */
export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: orgSlugSchema,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/** Input to invite/add a member to an org by email with a role. */
export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: orgRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;
