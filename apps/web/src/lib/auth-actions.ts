'use server';

/**
 * Server Actions for auth. A Server Action is a function that runs ON THE SERVER
 * but can be called directly from a form/Client Component — Next handles the RPC.
 * That's ideal here: the action talks to the API and sets httpOnly cookies, all
 * server-side, so credentials and tokens never live in client JavaScript.
 *
 * Each action returns a small `FormState` so the form can show validation/errors
 * inline (via React's useActionState).
 */
import { redirect } from 'next/navigation';
import {
  type AuthResponse,
  loginSchema,
  registerSchema,
} from '@saas/contracts';
import { ApiClientError, apiFetch } from './api';
import { clearSession, setSession } from './session';

export interface FormState {
  error?: string;
  /** Field-level errors keyed by field name, from the shared Zod schema. */
  fieldErrors?: Record<string, string[]>;
}

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Validate with the SAME schema the API uses — instant feedback, no round-trip
  // for obvious mistakes.
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const res = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: parsed.data,
      auth: false,
    });
    await setSession(res.tokens);
  } catch (err) {
    return toFormState(err);
  }

  redirect('/dashboard');
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const res = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: parsed.data,
      auth: false,
    });
    await setSession(res.tokens);
  } catch (err) {
    return toFormState(err);
  }

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  try {
    // Best-effort: tell the API to revoke the refresh token. We use the refresh
    // token endpoint's sibling /auth/logout, which needs the access token.
    await apiFetch<void>('/auth/logout', { method: 'POST' });
  } catch {
    // Even if revocation fails (e.g. token already expired), still clear locally.
  }
  await clearSession();
  redirect('/login');
}

/** Convert an API/network error into a user-safe FormState. */
function toFormState(err: unknown): FormState {
  if (err instanceof ApiClientError) {
    return { error: err.body.message, fieldErrors: err.body.details };
  }
  return { error: 'Something went wrong. Please try again.' };
}
