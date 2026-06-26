'use client';

/**
 * A Client Component (note 'use client') so it can use React hooks for form
 * state. `useActionState` binds the form to our SERVER ACTION: on submit, Next
 * sends the FormData to the server, runs loginAction, and gives us back its
 * returned FormState (errors) plus a pending flag — no manual fetch, no API URL
 * in the browser.
 */
import { useActionState } from 'react';
import { type FormState, loginAction } from '@/lib/auth-actions';

const initialState: FormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      {state.fieldErrors?.email && <p className="field-error">{state.fieldErrors.email[0]}</p>}

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {state.fieldErrors?.password && (
        <p className="field-error">{state.fieldErrors.password[0]}</p>
      )}

      {state.error && <p className="form-error">{state.error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
