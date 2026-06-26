import 'server-only';
import { cookies } from 'next/headers';
import type { AuthTokens } from '@saas/contracts';

/**
 * Session = the auth tokens, stored in HTTP-ONLY cookies.
 *
 * Why httpOnly cookies and not localStorage?
 *  - httpOnly cookies are NOT readable by JavaScript, so an XSS bug can't steal
 *    the tokens. localStorage is fully exposed to any script on the page.
 *  - These cookies are read only on the SERVER (Server Components / Actions),
 *    which is exactly where we make API calls in this app.
 *
 * `import 'server-only'` makes the build fail if this file is ever imported into
 * a Client Component by mistake — a guardrail so tokens never reach the browser.
 */

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}

export async function setSession(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  store.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    // Keep slightly longer than the token's own 15m expiry; the API is the real
    // authority on expiry, the cookie is just transport.
    maxAge: 60 * 30,
  });

  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
