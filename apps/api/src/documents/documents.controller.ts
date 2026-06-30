import { Controller, Get } from '@nestjs/common';
import type { PublicDocument } from '@saas/contracts';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';

/**
 * Document routes. Logged-in by default (global JwtAuthGuard). The list is scoped
 * to the caller's orgs inside the service, so there's no org param to guard here.
 */
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** GET /documents — every document in every org the caller belongs to. */
  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<PublicDocument[]> {
    return this.documents.listForUser(user.id);
  }
}
