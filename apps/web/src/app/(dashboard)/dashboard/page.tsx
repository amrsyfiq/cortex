import { redirect } from 'next/navigation';
import type { MembershipSummary, PublicUser } from '@saas/contracts';
import { ApiClientError, apiFetch } from '@/lib/api';
import { AssistantChat } from './assistant-chat';
import { WorkspaceSummary } from './workspace-summary';

/**
 * The dashboard. This is a SERVER COMPONENT: it fetches data on the server
 * (with the access token from the httpOnly cookie) and renders finished HTML.
 * No client-side data fetching, no loading spinner, no exposed token.
 *
 * We fetch two things in parallel:
 *   - /users/me        → who's logged in
 *   - /organizations   → the orgs they belong to, each with their role
 * exactly the data the multi-tenant model is designed to return.
 */
export default async function DashboardPage() {
  let user: PublicUser;
  let memberships: MembershipSummary[];

  try {
    [user, memberships] = await Promise.all([
      apiFetch<PublicUser>('/users/me'),
      apiFetch<MembershipSummary[]>('/organizations'),
    ]);
  } catch (err) {
    // Token expired/invalid → can't clear cookies during render, so redirect to
    // the /logout Route Handler, which clears the session and sends them to login.
    if (err instanceof ApiClientError && err.status === 401) {
      redirect('/logout');
    }
    throw err;
  }

  return (
    <main className="container">
      <h1>Welcome, {user.name}</h1>
      <p className="muted">{user.email}</p>

      <WorkspaceSummary />
      <AssistantChat />

      <h2 style={{ marginTop: '2rem', fontSize: '1.1rem' }}>Your organizations</h2>
      <p className="muted">
        One account, many tenants — your role is scoped to each organization.
      </p>

      {memberships.length === 0 ? (
        <p className="muted" style={{ marginTop: '1rem' }}>
          You don&apos;t belong to any organizations yet.
        </p>
      ) : (
        <div className="org-grid">
          {memberships.map(({ organization, role }) => (
            <div key={organization.id} className="org-card">
              <div className="name">{organization.name}</div>
              <div className="muted">/{organization.slug}</div>
              <span className={`badge ${role}`}>{role}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
