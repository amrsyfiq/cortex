import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ORG_ROLE_RANK, type OrgRole } from '@saas/contracts';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * THE multi-tenancy enforcement point. The global JwtAuthGuard already proved
 * "you are a logged-in user". This guard proves the harder, tenant-scoped
 * thing: "you are a member of THIS org, with at least the required role."
 *
 * Steps:
 *   1. Read the org `:slug` from the route params.
 *   2. Look up the caller's membership in that org.
 *   3. If there's no membership → 404 (we don't even admit the org exists to
 *      non-members — that prevents leaking which slugs are taken).
 *   4. If their role rank is below what @Roles requires → 403.
 *   5. Attach the membership to the request so handlers can use it without a
 *      second query.
 */
@Injectable()
export class OrgRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser; membership?: unknown }>();

    const user = request.user;
    const slugParam = request.params.slug;
    const slug = typeof slugParam === 'string' ? slugParam : undefined;
    if (!slug) {
      throw new NotFoundException('Organization not found');
    }

    const membership = await this.prisma.membership.findFirst({
      where: { user: { id: user.id }, organization: { slug } },
      include: { organization: true },
    });

    // Not a member (or org doesn't exist): same 404 either way, on purpose.
    if (!membership) {
      throw new NotFoundException('Organization not found');
    }

    const requiredRole = this.reflector.getAllAndOverride<OrgRole | undefined>(
      'requiredOrgRole',
      [context.getHandler(), context.getClass()],
    );

    if (requiredRole && ORG_ROLE_RANK[membership.role] < ORG_ROLE_RANK[requiredRole]) {
      throw new ForbiddenException(
        `This action requires the ${requiredRole} role in this organization`,
      );
    }

    // Stash for the handler so it doesn't re-query the membership/org.
    request.membership = membership;
    return true;
  }
}
