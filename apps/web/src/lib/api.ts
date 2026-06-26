import 'server-only';
import type { ApiError } from '@saas/contracts';
import { getAccessToken } from './session';

/**
 * The server-side API client. Every call to the NestJS backend goes through
 * here. It:
 *   - prefixes the configured API_URL,
 *   - attaches the access token from the httpOnly cookie as a Bearer header,
 *   - parses the JSON, and on a non-2xx response throws a typed ApiClientError
 *     carrying our standard ApiError body.
 *
 * Because this runs on the server, the token never touches the browser.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

/** Thrown on any non-2xx response. Carries the structured ApiError from the API. */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
    this.name = 'ApiClientError';
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Plain object, JSON-encoded automatically. */
  body?: unknown;
  /** Set false for endpoints that don't need auth (login/register). */
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set('Content-Type', 'application/json');

  if (auth) {
    const token = await getAccessToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    // Auth state changes per request; never cache API responses by default.
    cache: 'no-store',
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiClientError(res.status, json as ApiError);
  }

  return json as T;
}
