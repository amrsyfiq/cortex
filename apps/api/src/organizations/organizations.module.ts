import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

/**
 * OrgRoleGuard isn't listed here as a provider because it's applied per-route
 * with @UseGuards(OrgRoleGuard); Nest instantiates it on demand and injects its
 * deps (Reflector + the global PrismaService).
 */
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  // Exported so other modules (e.g. AssistantModule) can inject it.
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
