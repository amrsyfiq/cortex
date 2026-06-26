import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AddMemberInput,
  CreateOrganizationInput,
  MembershipSummary,
  OrgRole,
  PublicOrganization,
} from '@saas/contracts';
import { PrismaService } from '../prisma/prisma.service';

/** A member of an org as returned to clients: who they are + their role. */
export interface OrgMember {
  userId: string;
  email: string;
  name: string;
  role: OrgRole;
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an org AND make the creator its OWNER, atomically. The nested
   * `memberships.create` runs in the same transaction as the org insert, so we
   * can never end up with an org that has no owner.
   */
  async createForUser(
    userId: string,
    input: CreateOrganizationInput,
  ): Promise<PublicOrganization> {
    try {
      const org = await this.prisma.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          memberships: { create: { userId, role: 'OWNER' } },
        },
      });
      return this.toPublicOrg(org);
    } catch (err) {
      // P2002 = unique constraint violation (slug already taken).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`The slug "${input.slug}" is already taken`);
      }
      throw err;
    }
  }

  /** Every org the user belongs to, with the user's role in each. */
  async listForUser(userId: string): Promise<MembershipSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      organization: this.toPublicOrg(m.organization),
      role: m.role,
    }));
  }

  /** All members of an org. Caller's access is already proven by OrgRoleGuard. */
  async listMembers(slug: string): Promise<OrgMember[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { organization: { slug } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    }));
  }

  /**
   * Members of an org, but ONLY if `userId` is a member of it. This is the
   * authorization boundary used by the AI assistant's tool: the LLM is untrusted
   * and may ask about ANY org, so we verify membership here (404 to non-members,
   * like OrgRoleGuard) rather than trusting the model to behave.
   */
  async listMembersForUser(userId: string, slug: string): Promise<OrgMember[]> {
    const membership = await this.prisma.membership.findFirst({
      where: { user: { id: userId }, organization: { slug } },
    });
    if (!membership) throw new NotFoundException('Organization not found');
    return this.listMembers(slug);
  }

  /**
   * Add an existing user to an org by email. (A fuller product would email an
   * invitation to non-users; here we keep it to existing accounts to stay
   * focused on the authorization model.)
   */
  async addMember(slug: string, input: AddMemberInput): Promise<OrgMember> {
    const org = await this.prisma.organization.findUnique({ where: { slug } });
    if (!org) throw new NotFoundException('Organization not found');

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new NotFoundException(`No user found with email ${input.email}`);
    }

    try {
      const membership = await this.prisma.membership.create({
        data: { organizationId: org.id, userId: user.id, role: input.role },
        include: { user: true },
      });
      return {
        userId: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.role,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('That user is already a member of this organization');
      }
      throw err;
    }
  }

  private toPublicOrg(org: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  }): PublicOrganization {
    return { id: org.id, name: org.name, slug: org.slug, createdAt: org.createdAt };
  }
}
