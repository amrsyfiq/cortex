import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cortex',
  description: 'Cortex — multi-tenant workspace app with LLM features: an in-app AI chatbot and automated workspace summaries, powered by the Google Gemini API',
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
