import { expect, test, type Page } from '@playwright/test';
import { waitForUserIndexedDb } from './helpers/idb';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('command palette', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local IndexedDB log — not the hosted build.');

  test('logs three foods in a row without closing, via Toast undo not a proposal card', async ({
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

    await seedPaletteFoods(page);
    await page.reload();
    await expect(page.locator('[data-desk-shell]')).toBeVisible();
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
                const req = db
                  .transaction('foods', 'readonly')
                  .objectStore('foods')
                  .get('aaaaaaaa-1111-4111-8111-111111111111');
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
      .toBe('E2E Palette Kanin');

    const dialog = await openPalette(page);
    await expect(dialog).toHaveAttribute('data-palette-view', 'ready');
    await expect(dialog.getByText('You usually eat around now')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toHaveCount(0);

    for (const name of ['E2E Palette Kanin', 'E2E Palette Adobo', 'E2E Palette Sinigang']) {
      await logNamed(page, name);
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel('This plate').getByText(name, { exact: true })).toBeVisible();
    }

    await expect(dialog.getByText('palette stays open')).toBeVisible();
    await expect(page.getByText('Logged E2E Palette Sinigang')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Apply' })).toHaveCount(0);
  });

  test('no-match is a designed leave screen, not an error', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/login');
    const skip = page.getByRole('button', { name: 'Skip login on this machine' });
    if (!(await skip.isVisible().catch(() => false))) {
      test.skip(true, 'Local sign-in is not available.');
    }
    await skip.click();
    await page.waitForURL('**/today');
    await expect(page.locator('[data-desk-shell]')).toBeVisible();

    const dialog = await openPalette(page);
    await dialog.getByRole('combobox').fill('zzzzqwertyfood');
    await expect(dialog).toHaveAttribute('data-palette-view', 'none', { timeout: 8_000 });
    await expect(dialog.getByText(/Nothing in PH core matches/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Create it in PH core/ })).toBeVisible();
    await expect(dialog.getByText(/Brands and USDA stay out of this palette/)).toBeVisible();
  });
});

async function openPalette(page: Page) {
  const dialog = page.locator('[data-palette="log"]');
  const logFood = page.getByRole('button', { name: 'Log food' });
  await expect(logFood).toBeVisible();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  try {
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  } catch {
    await logFood.click();
    await expect(dialog).toBeVisible();
  }
  return dialog;
}

async function logNamed(page: Page, name: string): Promise<void> {
  const dialog = page.locator('[data-palette="log"]');
  const input = dialog.getByRole('combobox');
  await input.fill(name);
  await expect(dialog.getByRole('option', { name: new RegExp(name) })).toBeVisible({
    timeout: 8_000,
  });
  await input.press('Enter');
  await expect(dialog).toHaveAttribute('data-palette-view', 'ready');
}

async function seedPaletteFoods(page: Page): Promise<void> {
  const dbName = await waitForUserIndexedDb(page);

  const seeded = await page.evaluate(async (name) => {
    if (!name) throw new Error('user IndexedDB name missing');
    const iso = new Date().toISOString();
    const foods = [
      ['aaaaaaaa-1111-4111-8111-111111111111', 'E2E Palette Kanin', '130'],
      ['aaaaaaaa-2222-4222-8222-222222222222', 'E2E Palette Adobo', '151'],
      ['aaaaaaaa-3333-4333-8333-333333333333', 'E2E Palette Sinigang', '104'],
    ] as const;

    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(name);
      open.onerror = () => reject(open.error ?? new Error('indexedDB.open failed'));
      open.onblocked = () => reject(new Error('indexedDB.open blocked'));
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('foods') || !db.objectStoreNames.contains('servings')) {
          db.close();
          reject(new Error(`foods/servings stores missing: ${[...db.objectStoreNames].join(',')}`));
          return;
        }
        const tx = db.transaction(['foods', 'servings'], 'readwrite');
        const foodStore = tx.objectStore('foods');
        const servingStore = tx.objectStore('servings');
        for (const [id, foodName, kcal] of foods) {
          foodStore.put({
            id,
            source: 'ph_core',
            source_id: id,
            name: foodName,
            name_tl: [],
            brand: null,
            barcode: null,
            kcal,
            protein_g: '6',
            carbs_g: '18',
            fat_g: '3',
            fiber_g: '1',
            sugar_g: '1',
            sodium_mg: '80',
            confidence: '0.80',
            verified_at: null,
            created_by: null,
            attribution: null,
            source_note: null,
            created_at: iso,
            updated_at: iso,
            server_updated_at: iso,
            deleted_at: null,
            verified_by_user: false,
            shared: false,
          });
          servingStore.put({
            id: crypto.randomUUID(),
            food_id: id,
            label: '1 serving',
            grams_equivalent: '150',
            is_default: true,
            created_at: iso,
            updated_at: iso,
            server_updated_at: iso,
          });
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('palette food put failed'));
      };
    });
    return foods.length;
  }, dbName);
  expect(seeded).toBe(3);
}
