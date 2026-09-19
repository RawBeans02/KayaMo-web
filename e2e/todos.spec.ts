import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('todos desk', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local desk — not the hosted build.');

  test('matches the day planner: capture, check-off, and wired Plan / Brain dump', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    // The three engines share one disposable account in CI and sync through
    // the same server, so a fixed title written by Chromium is pulled down into
    // WebKit's fresh database and the locator resolves to two rows. Make the
    // title unique per project and run instead.
    const label = `E2E check-off ${testInfo.project.name} ${testInfo.repeatEachIndex}-${Date.now().toString(36)}`;
    await page.goto('/login');
    const skip = page.getByRole('button', { name: 'Skip login on this machine' });
    if (!(await skip.isVisible().catch(() => false))) {
      test.skip(true, 'Local sign-in is not available.');
    }
    await skip.click();
    await page.waitForURL('**/today');
    await expect(page.getByTestId('sync-status')).not.toHaveAttribute(
      'data-sync-kind',
      'local_db_error',
      { timeout: 15_000 },
    );

    await page.goto('/todos');
    await expect(page.locator('[data-todos]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan my day' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Brain dump' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Day' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Split in two' })).toHaveCount(0);

    await page.getByLabel('Capture a task').fill(label);
    await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add' }).click();
    const title = page.getByRole('button', { name: label, exact: false });
    await expect(title).toBeVisible();
    const row = title.locator('xpath=..');
    await row.getByRole('button', { name: 'Toggle done' }).click();
    await expect(row.getByRole('button', { name: 'Toggle done' })).toHaveAttribute('data-done', 'true');
  });
});
