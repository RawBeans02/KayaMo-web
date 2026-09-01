import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueUpsert, pendingCount, markQueueFailure, DEAD_LETTER_ATTEMPTS, dueQueueItems, syncQueueCounts, reviveDeadLetterItems } from './queue';
import { getOfflineDb, queueItemId, resetOfflineDb } from './db';
import { logFoodEntry, saveMealTemplate } from './writes';

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

describe('sync queue idempotency', () => {
  beforeEach(async () => {
    await resetOfflineDb();
  });

  afterEach(async () => {
    await resetOfflineDb();
  });

  it('replaces the queue row when the same entity is written twice', async () => {
    const payload = {
      id: 'entry-1',
      user_id: 'user-1',
      kcal: '100',
      updated_at: '2026-08-16T04:00:00.000Z',
    };
    await enqueueUpsert('food_entries', 'entry-1', payload);
    await enqueueUpsert('food_entries', 'entry-1', { ...payload, kcal: '120' });

    expect(await pendingCount()).toBe(1);
    expect(await getOfflineDb().companion_events.count()).toBe(0);
    const item = await getOfflineDb().sync_queue.get(
      queueItemId('food_entries', 'entry-1', 'user-1'),
    );
    expect(item?.payload.kcal).toBe('120');
  });

  it('writes Dexie immediately when logging a meal', async () => {
    const entry = await logFoodEntry({
      userId: 'user-1',
      mealSlot: 'tanghalian',
      foodId: 'food-1',
      foodName: 'Kanin',
      quantity: '1',
      grams: '200',
      kcal: '260',
      protein_g: '5.4',
      carbs_g: '56.4',
      fat_g: '0.6',
      fiber_g: '0.8',
      sugar_g: '0.2',
      sodium_mg: '2',
      source: 'ph_core',
      resolvedVia: 'ph_core',
      inputMethod: 'quick',
      servingLabel: '1 tasa',
    });

    const stored = await getOfflineDb().food_entries.get(entry.id);
    expect(stored?.food_name_snapshot).toBe('Kanin');
    expect(await pendingCount()).toBe(2);
    expect(await getOfflineDb().companion_events.count()).toBe(1);
  });

  it('stores a meal template in Dexie and the sync queue', async () => {
    const template = await saveMealTemplate({
      userId: 'user-1',
      name: 'Baon',
      items: [
        {
          foodId: 'food-1',
          foodName: 'Kanin',
          quantity: '1',
          grams: '200',
          servingId: 's1',
          servingLabel: '1 tasa',
          kcal: '260',
          protein_g: '5',
          carbs_g: '56',
          fat_g: '0.6',
          fiber_g: '0.8',
          sugar_g: '0.2',
          sodium_mg: '2',
          source: 'ph_core',
          resolvedVia: 'ph_core',
          confidence: '0.90',
        },
      ],
    });
    const stored = await getOfflineDb().meal_templates.get(template.id);
    expect(stored?.name).toBe('Baon');
    expect(await pendingCount()).toBe(1);
  });

  it('stops retrying after the dead-letter threshold', async () => {
    const payload = {
      id: 'entry-dead',
      user_id: 'user-1',
      kcal: '100',
      updated_at: '2026-08-16T04:00:00.000Z',
    };
    await enqueueUpsert('food_entries', 'entry-dead', payload);
    const item = await getOfflineDb().sync_queue.get(
      queueItemId('food_entries', 'entry-dead', 'user-1'),
    );
    expect(item).toBeTruthy();
    await getOfflineDb().sync_queue.put({
      ...item!,
      attempt: DEAD_LETTER_ATTEMPTS - 1,
    });
    const current = await getOfflineDb().sync_queue.get(item!.id);
    expect(current).toBeTruthy();
    await markQueueFailure(current!, Date.now() + 2_000, 'upsert_failed');
    const dead = await getOfflineDb().sync_queue.get(item!.id);
    expect(dead?.attempt).toBe(DEAD_LETTER_ATTEMPTS);
    expect(dead?.lastError).toMatch(/^needs_attention:/);
    expect(await dueQueueItems(Date.now() + 60_000)).toEqual([]);
    expect(await syncQueueCounts()).toEqual({ pending: 0, needsAttention: 1 });
    expect(await reviveDeadLetterItems('user-1')).toBe(1);
    expect(await syncQueueCounts()).toEqual({ pending: 1, needsAttention: 0 });
  });
});
