import { redirect } from 'next/navigation';
import { logoutAction } from '@/lib/auth-actions';
import { getAccessToken } from '@/lib/session';

/**
 * Layout for the (dashboard) route group. The parentheses mean the folder name
 * is NOT part of the URL — it just groups routes that share this layout and this
 * auth gate.
 *
 * This is our route protection: no access token → redirect to /login before any
 * dashboard page renders. Every page nested under here is guaranteed a session.
 *
 * The logout button is a <form> whose action is a Server Action — submitting it
 * runs logoutAction on the server (revoke + clear cookies) with zero client JS.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAccessToken())) redirect('/login');

  return (
    <div>
      <header className="topbar">
        <span className="brand">◆ SaaS Dashboard</span>
        <form action={logoutAction}>
          <button type="submit" className="logout-btn">
            Log out
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
