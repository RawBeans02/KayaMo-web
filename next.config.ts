import type { NextConfig } from 'next';
import { loadRootEnv } from './packages/db/src/load-root-env';

loadRootEnv();

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
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
