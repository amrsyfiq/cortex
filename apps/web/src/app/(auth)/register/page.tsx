import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccessToken } from '@/lib/session';
import { RegisterForm } from './register-form';

export default async function RegisterPage() {
  if (await getAccessToken()) redirect('/dashboard');

  return (
    <main className="center-screen">
      <div className="card narrow">
        <h1>Create your account</h1>
        <p className="muted">Start your multi-tenant workspace.</p>
        <RegisterForm />
        <p className="muted" style={{ marginTop: '1rem' }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
