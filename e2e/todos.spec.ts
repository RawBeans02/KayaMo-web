import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('todos desk', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local desk — not the hosted build.');

  test('is read-and-check-off; planner chrome is gone', async ({ page }) => {
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

    await page.goto('/todos');
    await expect(page.locator('[data-todos]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Plan my day' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Replan' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Fill' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'What now' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Parse dump' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Brain dump' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Place' })).toHaveCount(0);
    await expect(page.getByLabel('Energy')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Split in two' })).toHaveCount(0);

    await page.getByLabel('Capture').fill('E2E check-off');
    await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('button', { name: 'E2E check-off' })).toBeVisible();
    const row = page.getByRole('row', { name: /E2E check-off/ });
    await row.getByRole('button', { name: 'Done' }).click();
    await expect(row.getByRole('button', { name: 'Undo done' })).toBeVisible();
  });
});
