import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOfflineDb } from './db';
import {
  listLocalFoodHistory,
  listLocalFoodLedger,
  logFoodEntry,
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

const BASE = {
  userId: 'user-1',
  mealSlot: 'tanghalian',
  quantity: '1',
  grams: '100',
  protein_g: '2',
  carbs_g: '20',
  fat_g: '1',
  fiber_g: '0',
  sugar_g: '0',
  sodium_mg: '10',
  inputMethod: 'quick',
  timeZone: 'Asia/Manila',
  dayStartsAt: '05:00:00',
} as const;

describe('food history versus food ledger', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('history keeps only catalogued rows; the ledger keeps every live row', async () => {
    await logFoodEntry({
      ...BASE,
      foodId: 'food-1',
      foodName: 'Kanin',
      kcal: '130',
      source: 'ph_core',
      resolvedVia: 'ph_core',
      loggedAt: '2026-09-14T04:00:00.000Z',
    });
    // A worldwide-search result: a nutrition snapshot with no catalog row.
    await logFoodEntry({
      ...BASE,
      foodId: null,
      foodName: 'Greek yogurt',
      kcal: '59',
      source: 'usda_fdc',
      resolvedVia: 'usda_fdc',
      loggedAt: '2026-09-15T04:00:00.000Z',
    });
    // A personal food, also uncatalogued.
    const personal = await logFoodEntry({
      ...BASE,
      foodId: null,
      foodName: "Lola's tinola",
      kcal: '210',
      source: 'user',
      resolvedVia: 'user',
      loggedAt: '2026-09-16T04:00:00.000Z',
    });

    const history = await listLocalFoodHistory('user-1');
    expect(history.map((row) => row.food_name_snapshot)).toEqual(['Kanin']);

    const ledger = await listLocalFoodLedger('user-1');
    expect(ledger.map((row) => row.food_name_snapshot)).toEqual(['Kanin', 'Greek yogurt', "Lola's tinola"]);
    // This is the week-average bug in one number: history summed to 130 kcal
    // for a week in which 399 kcal were logged.
    expect(ledger.reduce((sum, row) => sum + Number(row.kcal), 0)).toBe(399);

    await tombstoneLocalFoodEntry({ id: personal.id, userId: 'user-1' });
    expect((await listLocalFoodLedger('user-1')).map((row) => row.food_name_snapshot)).toEqual([
      'Kanin',
      'Greek yogurt',
    ]);
  });

  it('is scoped to the user', async () => {
    await logFoodEntry({ ...BASE, userId: 'user-2', foodId: null, foodName: 'Other', kcal: '1', source: 'user', resolvedVia: 'user' });
    expect(await listLocalFoodLedger('user-1')).toEqual([]);
  });
});
