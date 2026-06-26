import { redirect } from 'next/navigation';
import { getAccessToken } from '@/lib/session';

/**
 * The index route is just a router: send logged-in users to the dashboard and
 * everyone else to login. This runs on the server, so the cookie check happens
 * before any HTML is sent.
 */
export default async function Home() {
  const token = await getAccessToken();
  redirect(token ? '/dashboard' : '/login');
}
