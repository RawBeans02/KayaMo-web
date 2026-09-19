import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

/**
 * First-load JavaScript per route, measured from the HTML the server actually
 * serves, gzipped the way the CDN would. Only meaningful against the
 * production build (`PLAYWRIGHT_WEB_SERVER=start`): the dev server ships
 * unminified, unsplit modules, so the numbers there say nothing.
 *
 * The budgets are ceilings just above the measured sizes on 2026-09-19, so a
 * regression fails and an improvement is a one-line edit here. Public pages
 * are held tighter because a visitor pays their cost before deciding anything.
 */
const BUDGET_KB: Array<{ path: string; label: string; gzipKb: number; guest?: boolean }> = [
  // Measured 2026-09-19 after the public pages moved to leaf entries:
  // landing 197, privacy 196, login 305 (it carries the Supabase client for
  // the emailed link), home and Lis 467.
  { path: '/', label: 'landing', gzipKb: 220 },
  { path: '/login', label: 'login', gzipKb: 330 },
  { path: '/privacy', label: 'privacy', gzipKb: 220 },
  { path: '/today', label: 'home', gzipKb: 490, guest: true },
  { path: '/mus', label: 'lis', gzipKb: 490, guest: true },
];

test.describe('bundle budget', () => {
  test.skip(
    process.env.PLAYWRIGHT_WEB_SERVER !== 'start',
    'Measures the production build only.',
  );

  for (const route of BUDGET_KB) {
    test(`${route.label} ships at most ${route.gzipKb} KB of gzipped JavaScript`, async ({
      page,
      request,
      baseURL,
    }) => {
      if (route.guest) {
        await page.goto('/');
        await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
        await page.waitForURL('**/today');
      }
      const html = await (route.guest
        ? page.goto(route.path).then((response) => response!.text())
        : request.get(route.path).then((response) => response.text()));
      const scripts = [...new Set([...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]!))];
      expect(scripts.length, 'the page references JavaScript').toBeGreaterThan(0);
      let gzipBytes = 0;
      for (const src of scripts) {
        const body = await request.get(`${baseURL}${src}`).then((response) => response.body());
        gzipBytes += gzipSync(body).length;
      }
      const gzipKb = Math.round(gzipBytes / 1024);
      test.info().annotations.push({ type: 'first-load-js-gzip-kb', description: String(gzipKb) });
      expect(gzipKb, `${route.path} first-load JS (gzip)`).toBeLessThanOrEqual(route.gzipKb);
    });
  }
});
