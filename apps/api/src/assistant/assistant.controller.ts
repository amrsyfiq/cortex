import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { orgSummarySchema, type OrgSummary } from '@saas/contracts';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { zodResponse } from '../common/swagger/zod-openapi';
import { AssistantService } from './assistant.service';

/**
 * Assistant routes. Logged-in by default (global JwtAuthGuard), so the summary
 * is always scoped to the authenticated user via @CurrentUser.
 */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** GET /assistant/summary — an AI summary of the caller's own organizations. */
  @Get('summary')
  @ApiOkResponse(zodResponse(orgSummarySchema, "AI summary of the caller's organizations"))
  summary(@CurrentUser() user: AuthenticatedUser): Promise<OrgSummary> {
    return this.assistant.summarizeOrganizations(user.id);
  }
}
