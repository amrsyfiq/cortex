import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SaaS Dashboard',
  description: 'Multi-tenant SaaS dashboard — Next.js + NestJS + Prisma',
};

/**
 * The ROOT layout wraps every page. In the App Router, layout.tsx files are
 * Server Components by default and persist across navigations (they don't
 * re-render when only the page below them changes).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
