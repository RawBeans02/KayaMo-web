import { loadRootEnv } from './packages/db/src/load-root-env';
import { defineConfig, devices } from '@playwright/test';

loadRootEnv();

const hostedBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/$/, '');
const baseURL = hostedBaseURL || 'http://localhost:3002';

export default defineConfig({
  testDir: './e2e',
  // Genuine constraint, not a speed workaround: local skip-login mints one
  // magic link for LOCAL_DEV_EMAIL. Parallel workers invalidate each other's
  // OTP and fail as "Could not complete local sign-in." Hosted runs skip
  // those specs, so they may use Playwright's default worker count.
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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
