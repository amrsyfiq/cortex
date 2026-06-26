import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatMessage, OrgSummary } from '@saas/contracts';
import type { Env } from '../config/env.validation';
import { OrganizationsService } from '../organizations/organizations.service';

/**
 * The AI assistant. Layer 1: a single, one-shot LLM call that summarizes the
 * caller's organizations.
 *
 * We talk to Google Gemini through its OpenAI-COMPATIBLE endpoint, using the
 * `openai` SDK. Why: the request/response shape (system + messages → choices)
 * is an industry standard, so switching providers later (Groq, OpenRouter, a
 * local Ollama, or OpenAI itself) is just a different baseURL + model — no code
 * changes. The provider is an implementation detail hidden inside this service.
 *
 * Like every other service it has NO HTTP awareness — it takes a userId and
 * returns plain data. The client is built ONCE in the constructor (a DI
 * singleton, like PrismaService) and the API key comes from the Zod-validated
 * config, so the key lives only on this server and never reaches the browser.
 */
@Injectable()
export class AssistantService {
  /** Gemini's OpenAI-compatible base URL. */
  private readonly baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

  /** A fast, free-tier Gemini model. Swap here to change models.
   *  (Note: 2.0-flash has a 0 free-tier quota on some projects; 2.5-flash works.) */
  private readonly model = 'gemini-2.5-flash';

  /** Null when no key is configured — we fail clearly instead of at call time. */
  private readonly client: OpenAI | null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly orgs: OrganizationsService, // reused from the Organizations module
  ) {
    const apiKey = this.config.get('GEMINI_API_KEY', { infer: true });
    this.client = apiKey ? new OpenAI({ apiKey, baseURL: this.baseURL }) : null;
  }

  /** Whether a key is configured — let controllers fail fast before streaming. */
  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Layer 2: a STREAMING chat. Returns an async generator that yields the
   * assistant's reply token-by-token as Gemini produces it.
   *
   * Conversation state is stateless on our side: the client sends the whole
   * `messages` history each turn (just like our JWT-stateless API). We prepend a
   * server-side system prompt with the user's real org context, so the assistant
   * can answer questions about their workspace — and we NEVER trust a system
   * message from the client.
   */
  async *streamChat(userId: string, messages: ChatMessage[]): AsyncGenerator<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'The AI assistant is not configured. Set GEMINI_API_KEY in apps/api/.env.',
      );
    }

    const memberships = await this.orgs.listForUser(userId);
    const facts = memberships.length
      ? memberships
          .map((m) => `- ${m.organization.name} (slug: ${m.organization.slug}) — role: ${m.role}`)
          .join('\n')
      : '(no organizations)';

    const stream = await this.client.chat.completions.create({
      model: this.model,
      stream: true, // ← the whole difference: an async iterable of partial chunks
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant inside a multi-tenant SaaS dashboard. ' +
            'Be concise and friendly. Only discuss the user and their workspace; ' +
            'do not invent data. The signed-in user belongs to these organizations:\n' +
            facts,
        },
        ...messages,
      ],
    });

    // Each chunk carries a small delta of the reply; yield the text as it arrives.
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async summarizeOrganizations(userId: string): Promise<OrgSummary> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'The AI assistant is not configured. Set GEMINI_API_KEY in apps/api/.env.',
      );
    }

    // 1) Pull the REAL domain data (multi-tenant, role-scoped) from our own service.
    const memberships = await this.orgs.listForUser(userId);

    // 2) Turn it into a compact, model-friendly description. Give it facts, not
    //    our internal objects, and never more than it needs.
    const facts = memberships.length
      ? memberships
          .map(
            (m) =>
              `- ${m.organization.name} (slug: ${m.organization.slug}) — your role: ${m.role}`,
          )
          .join('\n')
      : '(this user does not belong to any organizations yet)';

    // 3) The one-shot call. The `system` message is the assistant's standing
    //    instructions; the `user` message is the actual request.
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024, // a summary is deliberately short
      messages: [
        {
          role: 'system',
          content:
            'You are a concise assistant inside a multi-tenant SaaS dashboard. ' +
            'Given the organizations a user belongs to and their role in each, write a ' +
            'friendly 2-3 sentence summary of their workspace. Address the user directly ' +
            '("you"). Never invent organizations, roles, or data beyond what is provided. ' +
            'Respond with the summary only — no preamble, no markdown headings.',
        },
        {
          role: 'user',
          content: `Here are my organizations and roles:\n${facts}\n\nSummarize my workspace.`,
        },
      ],
    });

    // 4) The OpenAI-shaped response: the assistant's reply is the first choice's
    //    message content (a plain string here).
    const summary = completion.choices[0]?.message?.content?.trim() ?? '';

    return { summary };
  }
}
