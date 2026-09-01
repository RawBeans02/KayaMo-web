import { describe, expect, it } from 'vitest';
import { parseFoodMessageHeuristic } from '@kayamo/food';
import { applyFoodParse, type LedgerEntry } from './conversational-ledger';
import { emptyPersonalFoodMemory } from './personal-food-memory';

function entry(partial: Partial<LedgerEntry> & Pick<LedgerEntry, 'id' | 'food_name_snapshot'>): LedgerEntry {
  return {
    user_id: 'u1',
    meal_slot: 'hapunan',
    quantity: '1',
    grams: '100',
    serving_label_snapshot: '100 g',
    kcal: '200',
    protein_g: '5',
    carbs_g: '40',
    fat_g: '1',
    fiber_g: '0',
    sugar_g: '0',
    sodium_mg: '0',
    source: 'ph_core',
    resolved_via: 'ph_core',
    confidence: '0.9',
    logical_date: '2026-09-01',
    food_id: '11111111-1111-4111-8111-111111111111',
    deleted_at: null,
    ...partial,
  };
}

describe('applyFoodParse', () => {
  it('updates rice and reports a calorie delta without duplicating', async () => {
    const rice = entry({ id: 'rice-1', food_name_snapshot: 'Rice', quantity: '200', grams: '200', kcal: '260' });
    const rows = [rice];
    const parsed = parseFoodMessageHeuristic('actually rice was 170g', {
      logicalDate: '2026-09-01',
      entries: [{ id: rice.id, displayName: rice.food_name_snapshot, mealSlot: rice.meal_slot, quantity: 200, unit: 'g' }],
    });
    const result = await applyFoodParse(
      {
        userId: 'u1',
        logicalDate: '2026-09-01',
        today: '2026-09-01',
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
        parsed,
        rawMessage: 'actually rice was 170g',
        entries: rows,
        history: rows,
        memory: emptyPersonalFoodMemory(),
      },
      {
        resolve: async () => [],
        log: async (row) => entry({ id: crypto.randomUUID(), food_name_snapshot: row.foodName, kcal: row.kcal }),
        revise: async (row) => {
          Object.assign(rice, row, { quantity: row.quantity, grams: row.grams, kcal: row.kcal });
          return rice;
        },
        tombstone: async () => undefined,
      },
    );
    expect(result.lines[0]?.deltaKcal).toBeLessThan(0);
    expect(result.undo[0]).toMatchObject({ kind: 'revise', before: { id: 'rice-1', quantity: '200' } });
    expect(rows.filter((row) => row.food_name_snapshot === 'Rice')).toHaveLength(1);
  });

  it('copies yesterday breakfast as new ids', async () => {
    const source = entry({
      id: 'old',
      food_name_snapshot: 'Egg',
      meal_slot: 'almusal',
      logical_date: '2026-08-31',
    });
    const parsed = parseFoodMessageHeuristic('same breakfast as yesterday', {
      logicalDate: '2026-09-01',
      entries: [],
    });
    const created: string[] = [];
    const result = await applyFoodParse(
      {
        userId: 'u1',
        logicalDate: '2026-09-01',
        today: '2026-09-01',
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
        parsed,
        rawMessage: 'same breakfast as yesterday',
        entries: [],
        history: [source],
        memory: emptyPersonalFoodMemory(),
      },
      {
        resolve: async () => [],
        log: async (row) => {
          const id = crypto.randomUUID();
          created.push(id);
          return entry({ id, food_name_snapshot: row.foodName, meal_slot: row.mealSlot, logical_date: '2026-09-01' });
        },
        revise: async () => null,
        tombstone: async () => undefined,
      },
    );
    expect(created).toHaveLength(1);
    expect(result.undoIds).toEqual(created);
    expect(created[0]).not.toBe('old');
  });

  it('copies breakfast then changes eggs without a second egg row', async () => {
    const source = entry({
      id: 'old',
      food_name_snapshot: 'Egg',
      meal_slot: 'almusal',
      logical_date: '2026-08-31',
      quantity: '1',
      grams: '50',
      kcal: '80',
    });
    const parsed = parseFoodMessageHeuristic('same breakfast as yesterday but two eggs', {
      logicalDate: '2026-09-01',
      entries: [],
    });
    const rows: LedgerEntry[] = [];
    const result = await applyFoodParse(
      {
        userId: 'u1',
        logicalDate: '2026-09-01',
        today: '2026-09-01',
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
        parsed,
        rawMessage: 'same breakfast as yesterday but two eggs',
        entries: rows,
        history: [source],
        memory: emptyPersonalFoodMemory(),
      },
      {
        resolve: async () => [],
        log: async (row) => {
          const logged = entry({
            id: crypto.randomUUID(),
            food_name_snapshot: row.foodName,
            meal_slot: row.mealSlot,
            logical_date: '2026-09-01',
            quantity: row.quantity,
            grams: row.grams,
            kcal: row.kcal,
          });
          return logged;
        },
        revise: async (row) => {
          const target = rows.find((item) => item.id === row.id);
          if (!target) return null;
          Object.assign(target, { quantity: row.quantity, grams: row.grams, kcal: row.kcal });
          return target;
        },
        tombstone: async () => undefined,
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.quantity).toBe('2');
    expect(result.lines.some((line) => line.deltaKcal !== undefined)).toBe(true);
  });

  it('new day does not tombstone yesterday', async () => {
    const yesterday = entry({ id: 'y', logical_date: '2026-09-01', food_name_snapshot: 'Rice' });
    let deleted = 0;
    const parsed = parseFoodMessageHeuristic('new day', {
      logicalDate: '2026-09-01',
      entries: [{ id: 'y', displayName: 'Rice', mealSlot: 'almusal', quantity: 1 }],
    });
    const result = await applyFoodParse(
      {
        userId: 'u1',
        logicalDate: '2026-09-01',
        today: '2026-09-01',
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
        parsed,
        rawMessage: 'new day',
        entries: [yesterday],
        history: [yesterday],
        memory: emptyPersonalFoodMemory(),
      },
      {
        resolve: async () => [],
        log: async (row) => entry({ id: 'n', food_name_snapshot: row.foodName }),
        revise: async () => null,
        tombstone: async () => {
          deleted += 1;
        },
      },
    );
    expect(deleted).toBe(0);
    expect(result.nextDate).toBe('2026-09-02');
    expect(yesterday.deleted_at).toBeNull();
  });

  it('remembers personal food after confirm and logs 2 slices as 156 kcal', async () => {
    const parsed = parseFoodMessageHeuristic('Athlene is 123 calories and 22g protein per scoop', {
      logicalDate: '2026-09-01',
      entries: [],
    });
    const preview = await applyFoodParse(
      {
        userId: 'u1',
        logicalDate: '2026-09-01',
        today: '2026-09-01',
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
        parsed,
        rawMessage: 'Athlene is 123 calories and 22g protein per scoop',
        entries: [],
        history: [],
        memory: emptyPersonalFoodMemory(),
      },
      {
        resolve: async () => [],
        log: async (row) => entry({ id: 'x', food_name_snapshot: row.foodName, kcal: row.kcal }),
        revise: async () => null,
        tombstone: async () => undefined,
      },
    );
    expect(preview.needsConfirm).toBe(true);

    const saved = await applyFoodParse(
      { ...previewInput(parsed), confirmed: true, memory: preview.memory },
      {
        resolve: async () => [],
        log: async (row) => entry({ id: 'x', food_name_snapshot: row.foodName, kcal: row.kcal }),
        revise: async () => null,
        tombstone: async () => undefined,
      },
    );
    expect(saved.memory.foods[0]?.kcal).toBe(123);

    const two = parseFoodMessageHeuristic('2 marbys', { logicalDate: '2026-09-01', entries: [] });
    const memory = {
      aliases: { marbys: "Marby's Wheat Bread" },
      foods: [
        {
          displayName: "Marby's Wheat Bread",
          alias: 'marbys',
          servingQuantity: 1,
          servingUnit: 'slice',
          kcal: 78,
          protein_g: 3,
          carbs_g: 14,
          fat_g: 1,
        },
      ],
    };
    let loggedKcal = '';
    await applyFoodParse(
      {
        userId: 'u1',
        logicalDate: '2026-09-01',
        today: '2026-09-01',
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
        parsed: two,
        rawMessage: '2 marbys',
        entries: [],
        history: [],
        memory,
      },
      {
        resolve: async () => [],
        log: async (row) => {
          loggedKcal = row.kcal;
          return entry({ id: 'b', food_name_snapshot: row.foodName, kcal: row.kcal, quantity: row.quantity });
        },
        revise: async () => null,
        tombstone: async () => undefined,
      },
    );
    expect(Number(loggedKcal)).toBe(156);
  });

  it('asks before copying a whole day', async () => {
    const source = entry({
      id: 'old',
      food_name_snapshot: 'Rice',
      logical_date: '2026-08-31',
    });
    const parsed = parseFoodMessageHeuristic('copy yesterday', {
      logicalDate: '2026-09-01',
      entries: [],
    });
    let logged = 0;
    const preview = await applyFoodParse(
      {
        userId: 'u1',
        logicalDate: '2026-09-01',
        today: '2026-09-01',
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
        parsed,
        rawMessage: 'copy yesterday',
        entries: [],
        history: [source],
        memory: emptyPersonalFoodMemory(),
      },
      {
        resolve: async () => [],
        log: async (row) => {
          logged += 1;
          return entry({ id: 'n', food_name_snapshot: row.foodName });
        },
        revise: async () => null,
        tombstone: async () => undefined,
      },
    );
    expect(preview.needsConfirm).toBe(true);
    expect(logged).toBe(0);
  });
});

function previewInput(parsed: ReturnType<typeof parseFoodMessageHeuristic>) {
  return {
    userId: 'u1',
    logicalDate: '2026-09-01',
    today: '2026-09-01',
    timeZone: 'Asia/Manila',
    dayStartsAt: '00:00:00',
    parsed,
    rawMessage: 'Athlene is 123 calories and 22g protein per scoop',
    entries: [] as LedgerEntry[],
    history: [] as LedgerEntry[],
    memory: emptyPersonalFoodMemory(),
  };
}
