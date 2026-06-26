import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import {
  type ChatRequest,
  chatRequestSchema,
  orgSummarySchema,
  type OrgSummary,
} from '@saas/contracts';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { zodBody, zodResponse } from '../common/swagger/zod-openapi';
import { AssistantService } from './assistant.service';

/**
 * Assistant routes. Logged-in by default (global JwtAuthGuard), so everything is
 * scoped to the authenticated user via @CurrentUser.
 */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** GET /assistant/summary — a one-shot AI summary of the caller's organizations. */
  @Get('summary')
  @ApiOkResponse(zodResponse(orgSummarySchema, "AI summary of the caller's organizations"))
  summary(@CurrentUser() user: AuthenticatedUser): Promise<OrgSummary> {
    return this.assistant.summarizeOrganizations(user.id);
  }

  /**
   * POST /assistant/chat — a STREAMING chat. We bypass Nest's normal JSON
   * response (via @Res()) and write the reply token-by-token as plain text, so
   * the client can render it as it arrives.
   */
  @Post('chat')
  @ApiBody(zodBody(chatRequestSchema, { messages: [{ role: 'user', content: 'What orgs am I in?' }] }))
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    // Fail clearly BEFORE we start streaming (so it's a normal 503, not a broken stream).
    if (!this.assistant.isConfigured) {
      throw new ServiceUnavailableException(
        'The AI assistant is not configured. Set GEMINI_API_KEY in apps/api/.env.',
      );
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');

    try {
      for await (const token of this.assistant.streamChat(user.id, body.messages)) {
        res.write(token);
      }
    } catch {
      // Mid-stream failure (e.g. a 429 from the free tier). Headers are already
      // sent, so we can't change the status — append a marker and close.
      res.write('\n\n[The assistant ran into an error. Please try again.]');
    } finally {
      res.end();
    }
  }
}
