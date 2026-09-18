import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOfflineDb, resetOfflineDb } from './db';
import { dueQueueItems } from './queue';
import {
  FOOD_ENTRY_UNDO_MS,
  logFoodEntry,
  restoreLocalFoodEntry,
  tombstoneLocalFoodEntry,
} from './writes';

vi.mock('./sync', async () => {
  const status = await import('./status');
  return {
    drainQueue: vi.fn(async () => undefined),
    startSync: vi.fn(),
    getSyncStatusSnapshot: vi.fn(() => ({ kind: 'synced' })),
    bindStatusStore: status.subscribeSyncStatus,
    resumeSync: vi.fn(),
  };
});

const USER = 'user-1';

async function logOne() {
  return logFoodEntry({
    userId: USER,
    mealSlot: 'tanghalian',
    foodId: 'food-1',
    foodName: 'Kanin',
    quantity: '1',
    grams: '100',
    kcal: '130',
    protein_g: '2.7',
    carbs_g: '28.2',
    fat_g: '0.3',
    fiber_g: '0.4',
    sugar_g: '0.1',
    sodium_mg: '1',
    source: 'ph_core',
    resolvedVia: 'ph_core',
    inputMethod: 'quick',
    timeZone: 'Asia/Manila',
    dayStartsAt: '05:00:00',
  });
}

async function queuedFor(entityId: string) {
  return getOfflineDb().sync_queue.where('entityId').equals(entityId).toArray();
}

describe('food entry undo window', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('holds the tombstone back for the undo window instead of shipping it at once', async () => {
    const entry = await logOne();
    const before = Date.now();
    await tombstoneLocalFoodEntry({ id: entry.id, userId: USER });

    const [item] = await queuedFor(entry.id);
    expect(item?.payload.deleted_at).toBeTruthy();
    expect(item?.nextAttemptAt).toBeGreaterThanOrEqual(before + FOOD_ENTRY_UNDO_MS);
    expect(item?.nextAttemptAt).toBeLessThan(before + FOOD_ENTRY_UNDO_MS + 2000);

    // Not due now; due once the window has closed. Logging also queues rows for
    // other tables, so look only at this entity.
    const forEntry = (items: { entityId: string }[]) => items.filter((i) => i.entityId === entry.id);
    expect(forEntry(await dueQueueItems(Date.now(), USER))).toEqual([]);
    expect(forEntry(await dueQueueItems(Date.now() + FOOD_ENTRY_UNDO_MS + 2000, USER))).toHaveLength(1);
  });

  it('a restore inside the window replaces the queued tombstone with the live row', async () => {
    const entry = await logOne();
    await tombstoneLocalFoodEntry({ id: entry.id, userId: USER });
    await restoreLocalFoodEntry({ id: entry.id, userId: USER });

    const items = await queuedFor(entry.id);
    expect(items).toHaveLength(1);
    expect(items[0]?.payload.deleted_at).toBeNull();
    expect(items[0]?.nextAttemptAt).toBeLessThanOrEqual(Date.now());

    const local = await getOfflineDb().food_entries.get(entry.id);
    expect(local?.deleted_at).toBeNull();
  });

  it('the diary and the queue agree on the window', () => {
    expect(FOOD_ENTRY_UNDO_MS).toBe(8000);
  });
});
