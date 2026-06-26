'use client';

import { useActionState } from 'react';
import { type FormState, registerAction } from '@/lib/auth-actions';

const initialState: FormState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" autoComplete="name" required />
      {state.fieldErrors?.name && <p className="field-error">{state.fieldErrors.name[0]}</p>}

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      {state.fieldErrors?.email && <p className="field-error">{state.fieldErrors.email[0]}</p>}

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
      />
      {state.fieldErrors?.password && (
        <p className="field-error">{state.fieldErrors.password[0]}</p>
      )}

      {state.error && <p className="form-error">{state.error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
