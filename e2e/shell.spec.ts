import { expect, test, type Page } from '@playwright/test';

const VIEWPORT = { width: 1440, height: 800 };

test.use({ viewport: VIEWPORT });

test.describe('desktop shell overflow', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local grid contract — not the hosted build.');

  test('main scrolls inside the shell; ⌘\\ reclaims the 316px rail', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/login');
    const skip = page.getByRole('button', { name: 'Skip login on this machine' });
    if (!(await skip.isVisible().catch(() => false))) {
      test.skip(true, 'Local sign-in is not available.');
    }
    await skip.click();
    await page.waitForURL('**/today');
    await expect(page.locator('[data-desk-shell]')).toBeVisible();

    await seedTodayEntries(page);
    await page.reload();
    const onToday = await measureShell(page);
    expect(onToday.footerInView, 'sidebar footer stays on /today').toBe(true);
    expect(onToday.pageScrolls).toBe(false);

    await page.goto('/calories');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.locator('[data-shell="main"] tbody tr').first()).toBeVisible();

    const before = await measureShell(page);
    expect(before.pageScrolls, 'document should not scroll — main owns overflow').toBe(false);
    expect(before.mainScrolls, 'main must overflow internally when the log is long').toBe(true);
    expect(before.footerInView, 'sidebar footer must stay in the viewport').toBe(true);
    expect(before.railFootInView, 'rail footer must stay in the viewport').toBe(true);
    expect(before.railWidth).toBeGreaterThanOrEqual(310);
    expect(before.railWidth).toBeLessThanOrEqual(322);
    expect(before.columnCount).toBe(3);

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+\\' : 'Control+\\');
    await expect(page.locator('[data-desk-shell]')).toHaveAttribute('data-rail', 'collapsed');

    const after = await measureShell(page);
    expect(after.pageScrolls).toBe(false);
    expect(after.footerInView).toBe(true);
    expect(after.columnCount).toBe(3);
    expect(after.railWidth, 'collapsed rail is 40px, not an empty 316px gap').toBeGreaterThanOrEqual(36);
    expect(after.railWidth).toBeLessThanOrEqual(48);
    expect(after.mainWidth - before.mainWidth).toBeGreaterThan(250);
  });
});

async function seedTodayEntries(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const dbs = await indexedDB.databases();
    return dbs.some((db) => db.name?.includes(':user:'));
  });

  const seeded = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const name = dbs.find((db) => db.name?.includes(':user:'))?.name;
    if (!name) return 0;
    const userId = decodeURIComponent(name.split(':user:')[1] ?? '');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    const foods = [
      'Kanin',
      'Adobo',
      'Sinigang na baboy',
      'Pandesal',
      'Galunggong',
      'Mango',
      'Egg',
      'Tortang talong',
      'Saba',
      'Coffee',
    ];

    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(name);
      open.onerror = () => reject(open.error ?? new Error('indexedDB.open failed'));
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('food_entries')) {
          db.close();
          reject(new Error('food_entries store missing'));
          return;
        }
        const tx = db.transaction('food_entries', 'readwrite');
        const store = tx.objectStore('food_entries');
        for (let i = 0; i < 28; i += 1) {
          const logged = new Date();
          logged.setHours(7, i * 3, 0, 0);
          const iso = logged.toISOString();
          store.put({
            id: crypto.randomUUID(),
            user_id: userId,
            logged_at: iso,
            logical_date: today,
            meal_slot: i < 8 ? 'almusal' : i < 16 ? 'tanghalian' : 'hapunan',
            food_id: null,
            recipe_id: null,
            quantity: '1',
            serving_id: null,
            grams: '100',
            kcal: '120',
            protein_g: '6',
            carbs_g: '18',
            fat_g: '3',
            fiber_g: '1',
            sugar_g: '1',
            sodium_mg: '80',
            source: 'ph_core',
            confidence: '0.80',
            input_method: 'search',
            photo_url: null,
            raw_input: null,
            food_name_snapshot: foods[i % foods.length],
            serving_label_snapshot: null,
            resolved_via: 'ph_core',
            created_at: iso,
            updated_at: iso,
            server_updated_at: iso,
            deleted_at: null,
          });
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('food_entries put failed'));
      };
    });
    return 28;
  });
  expect(seeded).toBe(28);
}

async function measureShell(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[data-desk-shell]');
    const main = document.querySelector<HTMLElement>('[data-shell="main"]');
    const footer = document.querySelector<HTMLElement>('[data-shell="sidebar-footer"]');
    const rail = document.querySelector<HTMLElement>('[data-shell="rail"]');
    const railFoot = document.querySelector<HTMLElement>('[data-shell="rail-foot"]');
    if (!shell || !main || !footer || !rail) {
      throw new Error('shell landmarks missing');
    }
    const viewport = window.innerHeight;
    const footerBox = footer.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    const railFootBox = railFoot?.getBoundingClientRect();
    const columns = getComputedStyle(shell).gridTemplateColumns.split(' ').filter(Boolean);
    return {
      pageScrolls: document.documentElement.scrollHeight > viewport + 1,
      mainScrolls: main.scrollHeight > main.clientHeight + 1,
      footerInView: footerBox.bottom <= viewport + 1 && footerBox.top >= 0,
      railFootInView: railFootBox ? railFootBox.bottom <= viewport + 1 && railFootBox.top >= 0 : true,
      railWidth: Math.round(railBox.width),
      mainWidth: Math.round(main.getBoundingClientRect().width),
      columnCount: columns.length,
    };
  });
}
