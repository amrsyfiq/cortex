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
