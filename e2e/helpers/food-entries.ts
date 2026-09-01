import { expect, type Page } from '@playwright/test';
import { waitForUserIndexedDb } from './idb';

/** Seeds 28 diary rows so `/calories` overflows and meal groups are visible. */
export async function seedTodayEntries(page: Page): Promise<void> {
  const name = await waitForUserIndexedDb(page);
  const seeded = await page.evaluate(async (dbName) => {
    const userId = decodeURIComponent(dbName.split(':user:')[1] ?? '');
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
      const open = indexedDB.open(dbName);
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
  }, name);
  expect(seeded).toBe(28);
}
