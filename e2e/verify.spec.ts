import { expect, test } from '@playwright/test';
import { waitForUserIndexedDb } from './helpers/idb';
import { seedPhCoreFoods } from './helpers/ph-core-foods';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('verify desk', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local IndexedDB / PH core — not the hosted build.');

  test('inspector recomputes Atwater live, skip jumps, and verify uses Toast not a proposal card', async ({
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
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const dbs = await indexedDB.databases();
            const name = dbs.find((db) => db.name?.includes(':user:'))?.name;
            if (!name) return '';
            return new Promise<string>((resolve, reject) => {
              const open = indexedDB.open(name);
              open.onerror = () => reject(open.error ?? new Error('indexedDB.open failed'));
              open.onsuccess = () => {
                const db = open.result;
                if (!db.objectStoreNames.contains('foods')) {
                  db.close();
                  resolve('');
                  return;
                }
                const req = db
                  .transaction('foods', 'readonly')
                  .objectStore('foods')
                  .get('bbbbbbbb-1111-4111-8111-111111111111');
                req.onsuccess = () => {
                  const row = req.result as { name?: string } | undefined;
                  db.close();
                  resolve(row?.name ?? '');
                };
                req.onerror = () => {
                  db.close();
                  reject(req.error ?? new Error('foods get failed'));
                };
              };
            });
          }),
        { timeout: 15_000 },
      )
      .toBe('E2E Verify Adobo');

    await page.goto('/verify');
    await expect(page.locator('[data-verify]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verify', exact: true })).toBeVisible();
    const row = page.locator('[data-verify-row]').first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    await expect(page.locator('[data-atwater-detail]')).toBeVisible();
    const before = await page.locator('[data-atwater-detail]').textContent();
    expect(before).toMatch(/4P \+ 4C \+ 9F/);

    const kcal = page.getByLabel('kcal per 100 g');
    await kcal.fill('999');
    await expect(page.locator('[data-verify] [data-dirty="true"]')).toBeVisible();
    await expect(page.locator('[data-atwater-detail]')).not.toHaveText(before ?? '');
    await expect(page.locator('[data-atwater-detail]')).toContainText('stated 999');
    await expect(page.getByText('Macros do not reconcile')).toBeVisible();

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
    await expect(page.locator('[data-verify] [data-dirty="true"]')).toHaveCount(0);

    const firstName = (await row.locator('strong').textContent()) ?? '';
    await page.getByRole('button', { name: 'Skip for later' }).click();
    await expect(page.locator('[data-verify-row][data-active="true"] strong')).not.toHaveText(firstName);

    await page.locator('[data-verify-cell]').first().click();
    await expect(page.locator('[data-verify-row]').first()).toHaveAttribute('data-active', 'true');

    await page.getByLabel('Jump to a dish by name or alias').fill('Sinigang');
    await expect(page.locator('[data-verify-row][data-active="true"] strong')).toContainText(/Sinigang/i);
    await page.locator('[data-verify-cell]').first().click();

    await page.getByRole('button', { name: 'Mark verified' }).click();
    await expect(page.getByRole('status')).toContainText('Verified');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(page.getByText('medium risk · preview first')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
  });
});
