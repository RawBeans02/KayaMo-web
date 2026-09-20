import { expect, test } from '@playwright/test';

/**
 * Lis speaks first on Home, from the person's own records and no model call.
 * The demo is a fresh person, so the first-day line shows; after one logged
 * food the greeting reads the day and the readings row moves with it.
 */
test.describe('home greeting and readings', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });

  test('a first day is greeted as one, and the readings read zero without blame', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore the demo' }).click();
    await page.waitForURL('**/today');
    const greeting = page.locator('[data-home-greeting]');
    await expect(greeting).toHaveAttribute('data-home-greeting', 'first');
    await expect(greeting).toContainText('exactly right for a first day');
    await expect(page.locator('[data-home-greeting] img')).toHaveAttribute(
      'src',
      '/botanical/lis-bee.webp',
    );
    await expect(page.getByText('your first day')).toBeVisible();

    const meter = page.getByRole('meter', { name: 'Calories today' });
    await expect(meter).toHaveAttribute('aria-valuenow', '0');
    await expect(meter).toHaveAttribute('aria-valuetext', 'Nothing logged yet');
    await expect(page.getByLabel('Meals logged', { exact: true })).toContainText('0');
    await expect(page.getByLabel('Meals logged', { exact: true })).toContainText('of 4');
    await expect(page.getByLabel('Streak', { exact: true })).toContainText('Starts with today');
    await expect(page.locator('[data-home-streak]')).toHaveAttribute('data-home-streak', '0');
    // No target before onboarding: the ring says so instead of pretending.
    await expect(page.getByText('No target yet', { exact: false })).toBeVisible();
    // Never a debt, never a warning.
    await expect(page.locator('[data-home-readings]')).not.toContainText(/missed|over|behind/i);
  });

  test('one logged food turns the greeting into a reading of the day', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore the demo' }).click();
    await page.waitForURL('**/today');
    await expect(page.locator('[data-home-greeting]')).toHaveAttribute(
      'data-home-greeting',
      'first',
    );
    // The shortcut lives on the shell; wait for it and for the demo catalog.
    await expect(page.locator('[data-desk-shell]')).toBeVisible();
    await expect(page.getByTestId('sync-status')).not.toHaveAttribute(
      'data-sync-kind',
      'local_db_error',
    );
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    const palette = page.locator('[data-palette="log"]');
    await palette.getByRole('combobox').fill('kanin');
    await expect(palette.getByRole('option').first()).toBeVisible();
    await palette.getByRole('combobox').press('Enter');
    await expect(page.getByLabel('This plate')).toContainText(/kanin/i);
    await page.keyboard.press('Escape');

    const greeting = page.locator('[data-home-greeting]');
    await expect(greeting).toHaveAttribute('data-home-greeting', 'normal');
    await expect(greeting).toContainText(/You are at [\d,]+ kcal so far/);
    await expect(page.getByLabel('Meals logged', { exact: true })).toContainText('1');
    await expect(page.locator('[data-home-streak]')).toHaveAttribute('data-home-streak', '1');
    await expect(page.getByLabel('Streak', { exact: true })).toContainText('1 day');
    const meter = page.getByRole('meter', { name: 'Calories today' });
    await expect(meter).toHaveAttribute('aria-valuetext', /kcal logged, no target yet$/);
  });
});
