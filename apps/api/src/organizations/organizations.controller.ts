import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import {
  type AddMemberInput,
  type CreateOrganizationInput,
  type MembershipSummary,
  type PublicOrganization,
  addMemberSchema,
  createOrganizationSchema,
} from '@saas/contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { zodBody } from '../common/swagger/zod-openapi';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from './decorators/roles.decorator';
import { OrgRoleGuard } from './guards/org-role.guard';
import { OrganizationsService, type OrgMember } from './organizations.service';

/**
 * Organization routes. Every route requires a logged-in user (global guard).
 * The org-scoped routes additionally use OrgRoleGuard to enforce membership and
 * role WITHIN the specific org named in the URL.
 */
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  /** POST /organizations — any logged-in user can create one (becomes OWNER). */
  @Post()
  @ApiBody(zodBody(createOrganizationSchema, { name: 'Initech', slug: 'initech' }))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationInput,
  ): Promise<PublicOrganization> {
    return this.orgs.createForUser(user.id, body);
  }

  /** GET /organizations — the orgs the caller belongs to + their role in each. */
  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<MembershipSummary[]> {
    return this.orgs.listForUser(user.id);
  }

  /**
   * GET /organizations/:slug/members — must be a MEMBER (any role) of the org.
   * OrgRoleGuard with no @Roles() means "any member".
   */
  @UseGuards(OrgRoleGuard)
  @Get(':slug/members')
  listMembers(@Param('slug') slug: string): Promise<OrgMember[]> {
    return this.orgs.listMembers(slug);
  }

  /**
   * POST /organizations/:slug/members — must be at least ADMIN. @Roles('ADMIN')
   * tells OrgRoleGuard the minimum rank (ADMIN or OWNER).
   */
  @UseGuards(OrgRoleGuard)
  @Roles('ADMIN')
  @Post(':slug/members')
  @ApiBody(zodBody(addMemberSchema, { email: 'bob@example.com', role: 'MEMBER' }))
  addMember(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(addMemberSchema)) body: AddMemberInput,
  ): Promise<OrgMember> {
    return this.orgs.addMember(slug, body);
  }
}
