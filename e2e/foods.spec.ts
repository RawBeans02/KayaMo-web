import { expect, test } from '@playwright/test';
import { waitForUserIndexedDb } from './helpers/idb';
import { seedPhCoreFoods } from './helpers/ph-core-foods';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('foods desk', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local catalog — not the hosted build.');

  test('filters the catalog, never prints a photo point kcal, and opens an inspector', async ({
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

    await waitForUserIndexedDb(page);
    await seedPhCoreFoods(page);
    await page.reload();
    await waitForUserIndexedDb(page);

    await page.goto('/foods');
    await expect(page.locator('[data-foods]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Foods' })).toBeVisible();
    await expect(page.getByText('Logging happens in the palette, not here.')).toBeVisible();
    await expect(page.getByText('Shape of the database')).toBeVisible();
    await expect(page.getByRole('button', { name: /PH core/ })).toBeVisible();

    await expect(page.locator('[data-foods-row]').first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'PH core' }).click();
    await page.getByLabel('Filter by name or Taglish alias').fill('adobo');
    await expect(page.locator('[data-foods-row]').first()).toBeVisible();
    await page.locator('[data-foods-row]').first().click();
    await expect(page.locator('[data-foods-inspector] h2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add alias' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Merge as alias' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New food' })).toBeVisible();

    const photoKcal = page.locator('[data-foods-row][data-source="llm"] [data-kcal-cell]');
    if ((await photoKcal.count()) > 0) {
      await expect(photoKcal.first()).toHaveText(/—|–/);
    }
  });
});
