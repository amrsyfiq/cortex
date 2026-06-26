import { SetMetadata } from '@nestjs/common';
import type { OrgRole } from '@saas/contracts';

/**
 * Declares the MINIMUM org role required to call a route, read by OrgRoleGuard.
 *
 *   @Roles('ADMIN')
 *   @Post(':slug/members')
 *   addMember(...) {}
 *
 * Because roles are a hierarchy (OWNER > ADMIN > MEMBER), @Roles('ADMIN') means
 * "ADMIN or OWNER". A plain @UseGuards(OrgRoleGuard) with no @Roles means "any
 * member of the org".
 */
export const REQUIRED_ROLE_KEY = 'requiredOrgRole';
export const Roles = (role: OrgRole) => SetMetadata(REQUIRED_ROLE_KEY, role);
