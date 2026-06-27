import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cortex',
  description: 'Cortex — AI playground for experimenting with LLMs: a multi-tenant workspace app integrating the Google Gemini API for an in-app AI chatbot and automated workspace summaries',
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
