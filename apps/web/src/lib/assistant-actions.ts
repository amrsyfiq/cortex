'use server';

/**
 * Server Action for the AI assistant. Runs on the server, calls the NestJS
 * /assistant/summary route (with the access token from the httpOnly cookie via
 * apiFetch), and returns the summary or a user-safe error. The Gemini key and
 * the access token never reach the browser.
 */
import type { OrgSummary } from '@saas/contracts';
import { ApiClientError, apiFetch } from './api';

export interface SummaryState {
  summary?: string;
  error?: string;
}

export async function summarizeWorkspaceAction(
  _prev: SummaryState,
  _formData: FormData,
): Promise<SummaryState> {
  try {
    const res = await apiFetch<OrgSummary>('/assistant/summary');
    return { summary: res.summary };
  } catch (err) {
    if (err instanceof ApiClientError) {
      // e.g. 503 if the key isn't set, 429 if the free tier is rate-limited.
      return { error: err.body.message };
    }
    return { error: 'Could not generate a summary. Please try again.' };
  }
}
