import { expect, test } from '@playwright/test';
import { waitForUserIndexedDb } from './helpers/idb';
import { seedActiveRest } from './helpers/rest-timer';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('gym session clock', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local desk — not the hosted build.');

  test('rest stays on the shell after leaving Gym', async ({ page }) => {
    test.setTimeout(90_000);
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

    await waitForUserIndexedDb(page);
    await seedActiveRest(page, 90);

    await page.goto('/foods');
    const rest = page.locator('[data-gym-rest]');
    await expect(rest).toBeVisible({ timeout: 10_000 });
    await expect(rest).toContainText(/Timer keeps running if you leave Gym/);
    const clockText = await page.locator('[data-gym-rest-clock]').textContent();
    expect(clockText).toMatch(/^\d+:\d{2}$/);

    await page.goto('/todos');
    await expect(page.locator('[data-todos]')).toBeVisible();
    await expect(page.locator('[data-gym-rest]')).toBeVisible();
    await expect(page.locator('[data-gym-rest]')).toContainText(/\d+:\d{2}/);

    await page.goto('/gym');
    await expect(page.locator('[data-gym]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy last workout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Split in two' })).toHaveCount(0);
    await expect(page.locator('[data-gym-rest]')).toBeVisible();
  });
});
