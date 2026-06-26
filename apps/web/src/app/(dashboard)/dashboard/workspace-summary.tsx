'use client';

/**
 * Client Component (needs the useActionState hook). A button that, on submit,
 * runs the summarizeWorkspaceAction server action and renders the AI summary it
 * returns — plus a pending state while Gemini is thinking. No fetch, no token,
 * no API URL in the browser; the form's action IS the server function.
 */
import { useActionState } from 'react';
import { type SummaryState, summarizeWorkspaceAction } from '@/lib/assistant-actions';

const initialState: SummaryState = {};

export function WorkspaceSummary() {
  const [state, formAction, pending] = useActionState(summarizeWorkspaceAction, initialState);

  return (
    <section className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <strong>AI assistant</strong>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Get a quick, AI-written summary of your organizations and roles.
          </p>
        </div>
        <form action={formAction}>
          <button type="submit" disabled={pending}>
            {pending ? 'Summarizing…' : '✨ Summarize my workspace'}
          </button>
        </form>
      </div>

      {state.summary && (
        <p style={{ marginTop: '1rem', lineHeight: 1.6 }}>{state.summary}</p>
      )}
      {state.error && (
        <p className="form-error" style={{ marginTop: '1rem' }}>
          {state.error}
        </p>
      )}
    </section>
  );
}
