import { loadRootEnv } from './packages/db/src/load-root-env';
import { defineConfig, devices } from '@playwright/test';

loadRootEnv();

const hostedBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/$/, '');
const baseURL = hostedBaseURL || 'http://localhost:3002';

export default defineConfig({
  testDir: './e2e',
  // Local skip-login mints one magic link for a shared email. Parallel workers
  // invalidate each other's OTP. Hosted runs skip those specs.
  workers: hostedBaseURL ? undefined : 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: hostedBaseURL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3002/login',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
