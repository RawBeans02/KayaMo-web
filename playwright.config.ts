import { loadRootEnv } from './packages/db/src/load-root-env';
import { defineConfig, devices } from '@playwright/test';

loadRootEnv();

const hostedBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/$/, '');
const baseURL = hostedBaseURL || 'http://localhost:3002';

// A Vercel preview sits behind Deployment Protection, which answers every
// request with a redirect to a Vercel sign-in. Vercel's "Protection Bypass for
// Automation" secret (project settings → Deployment Protection) lets a test
// runner through: sent as a header on the first request, with the second
// header asking Vercel to set the bypass cookie so page navigations after it
// pass too. Read from the environment, never committed.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const bypassHeaders =
  hostedBaseURL && bypassSecret
    ? {
        'x-vercel-protection-bypass': bypassSecret,
        'x-vercel-set-bypass-cookie': 'true',
      }
    : undefined;

export default defineConfig({
  testDir: './e2e',
  // Genuine constraint, not a speed workaround: local skip-login mints one
  // magic link for LOCAL_DEV_EMAIL. Parallel workers invalidate each other's
  // OTP and fail as "Could not complete local sign-in." Hosted runs skip
  // those specs, so they may use Playwright's default worker count.
  workers: hostedBaseURL ? undefined : 1,
  // `trace: 'on-first-retry'` records nothing when retries is 0, which it was,
  // so no CI failure ever had a trace. One retry in CI turns the setting on and
  // separates a flake from a failure in the report; locally a failure stays a
  // failure so it is noticed.
  retries: process.env.CI ? 1 : 0,
  // Hosted mode runs against a Vercel preview from wherever the runner sits.
  // Opening the demo there took 3.5 s on WebKit in the 2026-09-19 smoke
  // (functions in iad1, Supabase in ap-south-1, runner in the Philippines),
  // so Firefox and WebKit crossed the 5 s default on some attempts while
  // Chromium never did, and a spec with several page loads ran out of its
  // 30 s on Firefox. 15 s per expectation and 60 s per test separate a slow
  // round trip from a failure; the localhost runs, and CI, keep the defaults.
  ...(hostedBaseURL ? { timeout: 60_000, expect: { timeout: 15_000 } } : {}),
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...(bypassHeaders ? { extraHTTPHeaders: bypassHeaders } : {}),
  },
  // PLAYWRIGHT_WEB_SERVER=start serves the production build (`pnpm build`
  // first) instead of the dev server; CI runs both. The guest cookie is Secure
  // only over HTTPS, so the demo works on plain-HTTP localhost either way.
  webServer: hostedBaseURL
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_WEB_SERVER === 'start' ? 'pnpm start' : 'pnpm dev',
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
