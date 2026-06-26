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
  ];

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

    // The running conversation we send to the model. It grows as the model calls
    // tools and we append the results.
    const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant inside a multi-tenant SaaS dashboard. ' +
          'Be concise and friendly. Only discuss the user and their workspace; ' +
          'do not invent data. Use the list_org_members tool to look up who is in ' +
          'an organization. The signed-in user belongs to these organizations:\n' +
          facts,
      },
      ...messages,
    ];

    // THE AGENTIC LOOP. Each pass streams the model's response; if it asked to
    // call tools, we run them, append the results, and loop so the model can
    // answer using them. It ends when the model replies with text instead of a
    // tool call. The bound (4) stops a runaway tool-calling loop.
    for (let step = 0; step < 4; step++) {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        stream: true,
        tools: this.tools,
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
    if (name !== 'list_org_members') {
      return JSON.stringify({ error: `Unknown tool: ${name}` });
    }

    let slug = '';
    try {
      const parsed: unknown = JSON.parse(argsJson || '{}');
      if (parsed && typeof parsed === 'object' && 'slug' in parsed) {
        const value = (parsed as { slug: unknown }).slug;
        if (typeof value === 'string') slug = value;
      }
    } catch {
      return JSON.stringify({ error: 'Invalid tool arguments.' });
    }

    try {
      // listMembersForUser enforces that the user is a member of this org.
      const members = await this.orgs.listMembersForUser(userId, slug);
      return JSON.stringify({ organization: slug, members });
    } catch {
      // Non-member or unknown org: tell the model, but reveal nothing.
      return JSON.stringify({ error: `You don't have access to "${slug}", or it does not exist.` });
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
