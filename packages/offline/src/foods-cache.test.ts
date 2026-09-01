import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Food } from '@kayamo/db';
import { getOfflineDb, resetOfflineDb } from './db';
import { cacheFood, evictFoodCacheLru, FOOD_CACHE_MAX } from './foods-cache';

function stubFood(id: string, source: Food['source']): Food {
  return {
    id,
    source,
    source_id: id,
    name: id,
    name_tl: [],
    brand: null,
    barcode: null,
    kcal: '100',
    protein_g: '0',
    carbs_g: '0',
    fat_g: '0',
    fiber_g: '0',
    sugar_g: '0',
    sodium_mg: '0',
    confidence: '0.5',
    verified_at: null,
    created_by: null,
    attribution: null,
    source_note: null,
    created_at: '2026-08-22T00:00:00.000Z',
    updated_at: '2026-08-22T00:00:00.000Z',
    server_updated_at: '2026-08-22T00:00:00.000Z',
    deleted_at: null,
    verified_by_user: false,
    shared: false,
  } as Food;
}

describe('Dexie food cache LRU', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  // 400 sequential Dexie puts plus a full-table LRU pass. Isolated this is ~3.4s
  // (68% of Vitest's 5s default) and times out under `pnpm -r`. That is the test
  // budget, not a logic failure — do not treat a retry as a fix.
  it('evicts the least-recent remote catalog rows past the cap and keeps user foods', { timeout: 15_000 }, async () => {
    for (let i = 0; i < FOOD_CACHE_MAX + 5; i += 1) {
      await cacheFood(stubFood(`off-${i}`, 'off'));
    }
    await cacheFood(stubFood('my-adobo', 'user'));
    await cacheFood(stubFood('kanin', 'ph_core'));

    expect(await evictFoodCacheLru()).toBe(0);
    const db = getOfflineDb();
    const remote = (await db.foods.toArray()).filter((row) => row.source === 'off');
    expect(remote).toHaveLength(FOOD_CACHE_MAX);
    expect(await db.foods.get('my-adobo')).toBeTruthy();
    expect(await db.foods.get('kanin')).toBeTruthy();
  });
});
