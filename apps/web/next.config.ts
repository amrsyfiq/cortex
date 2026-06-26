import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // We use React Server Components heavily and call the API from the server.
  reactStrictMode: true,

  // @saas/contracts ships compiled JS, so no transpilePackages needed. If you
  // ever switch it to ship raw TS source, add it here:
  // transpilePackages: ['@saas/contracts'],
};

export default nextConfig;
