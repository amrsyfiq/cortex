import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatMessage, OrgSummary } from '@saas/contracts';
import type { Env } from '../config/env.validation';
import { DocumentsService } from '../documents/documents.service';
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
   *  (Free tier is ~20 req/day per model; use a billing-enabled key for more.) */
  private readonly model = 'gemini-2.5-flash';

  /** Null when no key is configured — we fail clearly instead of at call time. */
  private readonly client: OpenAI | null;

  /**
   * Tools the model may call. We describe WHAT each tool does and WHEN to use it;
   * the model decides whether to call it and with what arguments. Our code runs
   * the tool (see runTool) — and enforces authorization there, never trusting the
   * model to only ask about orgs the user can see.
   */
  private readonly tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'list_org_members',
        description:
          'List the members (name, email, role) of an organization the signed-in ' +
          'user belongs to. Use this when the user asks who is in an organization, ' +
          'or about its owners/admins/members.',
        parameters: {
          type: 'object',
          properties: {
            slug: {
              type: 'string',
              description: 'The organization slug, e.g. "acme" or "globex".',
            },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_documents',
        description:
          'Search the notes and documents BY MEANING (semantic search over meeting ' +
          'notes, client circumstances, plans, decisions, etc.). Use this whenever ' +
          'the user asks about the CONTENT of notes or about clients/people/plans ' +
          'that are not in the member list — search FIRST instead of saying you ' +
          "can't help. Omit `slug` to search across all the user's organizations; " +
          'set it only to restrict to one org. Returns the most relevant excerpts.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'What to look for, in natural language.',
            },
            slug: {
              type: 'string',
              description:
                'Optional. The organization slug (e.g. "acme") to restrict the ' +
                "search to one org. Omit to search all the user's orgs.",
            },
          },
          required: ['query'],
        },
      },
    },
  ];

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly orgs: OrganizationsService, // reused from the Organizations module
    private readonly documents: DocumentsService, // semantic search over org notes
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

    // The running conversation we send to the model. It grows as the model calls
    // tools and we append the results.
    const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant inside a multi-tenant SaaS dashboard. ' +
          'Be concise and friendly. Only discuss the user and their workspace; ' +
          'do not invent data. Use the list_org_members tool to look up who is in ' +
          'an organization. Use the search_documents tool to answer ANY question ' +
          'about clients, people, plans, or circumstances that might be in the ' +
          'notes — search FIRST (across all their orgs if they did not name one) ' +
          "before saying you can't help. Call search_documents at most once per " +
          'question, then ANSWER from the results it returns — do not keep ' +
          'searching. The signed-in user belongs to these organizations:\n' +
          facts,
      },
      ...messages,
    ];

    // THE AGENTIC LOOP. Each pass streams the model's response; if it asked to
    // call tools, we run them, append the results, and loop so the model can
    // answer using them. It ends when the model replies with text instead of a
    // tool call. The bound stops a runaway tool-calling loop.
    const MAX_STEPS = 4;
    for (let step = 0; step < MAX_STEPS; step++) {
      // On the FINAL step we drop the tools, so the model is forced to answer in
      // text instead of calling yet another tool — this guarantees the user gets
      // a reply even if the model would otherwise keep searching forever.
      const isFinalStep = step === MAX_STEPS - 1;
      const stream = await this.client.chat.completions.create({
        model: this.model,
        stream: true,
        tools: isFinalStep ? undefined : this.tools,
        messages: convo,
      });

      // Tool-call fragments arrive split across chunks. Standard OpenAI keys them
      // by `index` (args streamed across chunks); Gemini's compat layer sends
      // `index: undefined` with the whole call in one chunk. Keying by
      // (index ?? id) handles BOTH — accumulate into a Map, then flatten.
      const toolCallsByKey = new Map<
        string | number,
        OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall
      >();
      let content = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          content += delta.content;
          yield delta.content; // stream the visible answer to the client
        }

        for (const tc of delta.tool_calls ?? []) {
          const key = tc.index ?? tc.id ?? 0;
          const prev = toolCallsByKey.get(key) ?? {
            id: '',
            type: 'function' as const,
            function: { name: '', arguments: '' },
          };
          toolCallsByKey.set(key, {
            id: tc.id ?? prev.id,
            type: 'function',
            function: {
              name: prev.function.name + (tc.function?.name ?? ''),
              arguments: prev.function.arguments + (tc.function?.arguments ?? ''),
            },
          });
        }
      }

      const toolCalls = [...toolCallsByKey.values()];
      // No tool calls → the model gave its final answer (already streamed). Done.
      if (toolCalls.length === 0) return;

      // Otherwise: record the model's tool-call turn, run each tool, append results.
      convo.push({ role: 'assistant', content: content || null, tool_calls: toolCalls });
      for (const call of toolCalls) {
        const result = await this.runTool(userId, call.function.name, call.function.arguments);
        convo.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
      // Loop: the next pass lets the model answer using the tool results.
    }
  }

  /**
   * Execute a tool the model asked for. THIS is the trust boundary: the model is
   * untrusted, so we validate arguments and enforce authorization here. We return
   * a JSON string (success data or an error) that goes back to the model.
   */
  private async runTool(userId: string, name: string, argsJson: string): Promise<string> {
    // Arguments arrive as a JSON string the model generated, so parse defensively.
    let args: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(argsJson || '{}');
      if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: 'Invalid tool arguments.' });
    }
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');

    if (name === 'list_org_members') {
      const slug = str(args.slug);
      try {
        // listMembersForUser enforces that the user is a member of this org.
        const members = await this.orgs.listMembersForUser(userId, slug);
        return JSON.stringify({ organization: slug, members });
      } catch {
        // Non-member or unknown org: tell the model, but reveal nothing.
        return JSON.stringify({ error: `You don't have access to "${slug}", or it does not exist.` });
      }
    }

    if (name === 'search_documents') {
      const slug = str(args.slug);
      const query = str(args.query);
      try {
        // With a slug, scope to that one org (membership enforced). Without one,
        // search across every org the user belongs to. Both stay inside the
        // user's tenancy — the model can't reach another tenant's notes.
        const matches = slug
          ? await this.documents.searchForUser(userId, slug, query)
          : await this.documents.searchAcrossUserOrgs(userId, query);
        return JSON.stringify({ scope: slug || 'all your organizations', matches });
      } catch {
        return JSON.stringify({ error: `You don't have access to "${slug}", or it does not exist.` });
      }
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
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
