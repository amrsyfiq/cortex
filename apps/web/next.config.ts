import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // We use React Server Components heavily and call the API from the server.
  reactStrictMode: true,

  // PRODUCTION/DOCKER: emit a self-contained server in `.next/standalone`.
  // `next build` traces exactly which files (incl. a minimal node_modules) the
  // server actually needs and copies them there, plus a ready-to-run server.js.
  // The Docker image then ships ONLY that folder — no pnpm, no source, no dev
  // deps — so it's small and avoids all the pnpm symlink headaches in Docker.
  output: 'standalone',

  // In a monorepo the files we depend on (e.g. @saas/contracts) live ABOVE
  // apps/web, so point file-tracing at the repo root or the trace misses them.
  // `__dirname` here is apps/web; '../../' is the workspace root.
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // @saas/contracts ships compiled JS, so no transpilePackages needed. If you
  // ever switch it to ship raw TS source, add it here:
  // transpilePackages: ['@saas/contracts'],
};

export default nextConfig;
