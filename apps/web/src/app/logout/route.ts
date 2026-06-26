import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

/**
 * A Route Handler (app/logout/route.ts → GET /logout). Unlike a page/layout,
 * Route Handlers ARE allowed to modify cookies — so this is the safe place to
 * clear the session when an access token has expired.
 *
 * Server Components (pages/layouts) can READ cookies but not WRITE/DELETE them
 * during render; the dashboard redirects here instead of calling clearSession()
 * itself.
 */
export async function GET(request: Request): Promise<NextResponse> {
  await clearSession();
  return NextResponse.redirect(new URL('/login', request.url));
}
