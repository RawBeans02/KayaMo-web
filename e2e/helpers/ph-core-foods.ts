import { expect, type Page } from '@playwright/test';
import { waitForUserIndexedDb } from './idb';

/** Seeds PH-core catalog rows so Verify can run without a live Supabase pull. */
export async function seedPhCoreFoods(page: Page): Promise<void> {
  const dbName = await waitForUserIndexedDb(page);
  const seeded = await page.evaluate(async (name) => {
    const iso = new Date().toISOString();
    const foods = [
      ['bbbbbbbb-1111-4111-8111-111111111111', 'E2E Verify Adobo', '160', '16', '4', '8'],
      ['bbbbbbbb-2222-4222-8222-222222222222', 'E2E Verify Kanin', '130', '2.5', '28', '0.3'],
      ['bbbbbbbb-3333-4333-8333-333333333333', 'E2E Verify Sinigang', '104', '12', '6', '3'],
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
        for (const [id, foodName, kcal, protein, carbs, fat] of foods) {
          foodStore.put({
            id,
            source: 'ph_core',
            source_id: id,
            name: foodName,
            name_tl: [],
            brand: null,
            barcode: null,
            kcal,
            protein_g: protein,
            carbs_g: carbs,
            fat_g: fat,
            fiber_g: '1',
            sugar_g: '1',
            sodium_mg: '80',
            confidence: '0.52',
            verified_at: null,
            created_by: null,
            attribution: null,
            source_note: 'E2E seed',
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
            grams_equivalent: '100',
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
        tx.onerror = () => reject(tx.error ?? new Error('PH-core food put failed'));
      };
    });
    return foods.length;
  }, dbName);
  expect(seeded).toBe(3);
}
