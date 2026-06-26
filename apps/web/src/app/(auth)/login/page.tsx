import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccessToken } from '@/lib/session';
import { LoginForm } from './login-form';

/**
 * Server Component: it checks the session server-side and bounces already
 * logged-in users straight to the dashboard, then renders the (client) form.
 */
export default async function LoginPage() {
  if (await getAccessToken()) redirect('/dashboard');

  return (
    <main className="center-screen">
      <div className="card narrow">
        <h1>Welcome back</h1>
        <p className="muted">Sign in to your SaaS dashboard.</p>
        <LoginForm />
        <p className="muted" style={{ marginTop: '1rem' }}>
          No account? <Link href="/register">Create one</Link>
        </p>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Demo: <code>alice@example.com</code> / <code>password123</code>
        </p>
      </div>
    </main>
  );
}
