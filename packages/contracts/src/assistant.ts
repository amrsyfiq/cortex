import { z } from 'zod';

/**
 * AI assistant contracts. The assistant lives on the API (so the Anthropic API
 * key never reaches the browser) and returns plain data the web app renders.
 */

/** An AI-generated summary of the organizations the caller belongs to. */
export const orgSummarySchema = z.object({
  summary: z.string(),
});
export type OrgSummary = z.infer<typeof orgSummarySchema>;

/** One turn in a chat conversation. We only allow user/assistant turns from the
 *  client; the system prompt is added server-side and never trusted from input. */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** The body sent to the streaming chat endpoint: the whole conversation so far. */
export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
