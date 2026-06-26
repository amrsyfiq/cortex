import { getAccessToken } from '@/lib/session';

/**
 * Streaming proxy (app/api/assistant/chat/route.ts → POST /api/assistant/chat).
 *
 * The browser can't call NestJS directly — the access token lives in an httpOnly
 * cookie it can't read. So this Route Handler runs on the SERVER: it reads the
 * cookie, forwards the request to NestJS with the Bearer token, and PIPES the
 * token stream straight back to the browser. The token never reaches client JS.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

export async function POST(request: Request): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const body = await request.text(); // pass the { messages } JSON through unchanged

  const upstream = await fetch(`${API_URL}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => 'Assistant request failed');
    return new Response(message, { status: upstream.status || 502 });
  }

  // Stream the upstream body straight through to the client.
  return new Response(upstream.body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' },
  });
}
