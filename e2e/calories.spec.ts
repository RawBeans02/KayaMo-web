import { expect, test } from '@playwright/test';
import { seedTodayEntries } from './helpers/food-entries';
import { waitForUserIndexedDb } from './helpers/idb';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('calories diary', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Local IndexedDB log — not the hosted build.',
  );

  test('restyles /calories as the designed log and leaves /today as the dashboard', async ({
    page,
  }) => {
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

    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: "Today's plan", exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-calories-log]')).toHaveCount(0);

    await seedTodayEntries(page);
    await page.goto('/calories');
    await waitForUserIndexedDb(page);

    const diary = page.locator('[data-calories-log]');
    await expect(diary).toBeVisible();
    await expect(page.getByText(/^Diary · week/)).toBeVisible();
    await expect(page.locator('[data-week-strip] button')).toHaveCount(7);
    await expect(page.locator('[data-meal-group="almusal"]')).toBeVisible();
    await expect(page.locator('[data-meal-group="tanghalian"]')).toBeVisible();
    await expect(page.locator('[data-meal-group="meryenda"]')).toBeVisible();
    await expect(page.locator('[data-meal-group="hapunan"]')).toBeVisible();
    await expect(page.locator('[data-entry-row]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0);

    await page.locator('[data-add-meal="meryenda"]').click();
    const palette = page.locator('[data-palette="log"]');
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('button', { name: /Snack/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();

    const firstName = await page.locator('[data-entry-row] strong').first().textContent();
    expect(firstName).toBeTruthy();
    await page
      .getByRole('button', { name: `Remove ${firstName}` })
      .first()
      .click();
    await expect(page.getByRole('status')).toContainText(`Removed ${firstName}`);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
  });
});
