import type { NextConfig } from 'next';
import { loadRootEnv } from './packages/db/src/load-root-env';
import { securityHeaders } from './src/lib/security-headers';

loadRootEnv();

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders({ vercelEnv: process.env.VERCEL_ENV }),
      },
    ];
  },
  transpilePackages: [
    '@kayamo/ai',
    '@kayamo/core',
    '@kayamo/db',
    '@kayamo/features',
    '@kayamo/food',
    '@kayamo/offline',
    '@kayamo/ui',
  ],
};

export default nextConfig;
