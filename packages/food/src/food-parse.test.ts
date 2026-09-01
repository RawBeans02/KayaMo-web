import { describe, expect, it } from 'vitest';
import { calculateDailyNutrition } from './daily-nutrition';
import { estimateEnergyBalance } from './energy-balance';
import { extractStatedNutrition, parseFoodMessageHeuristic } from './food-parse';
import { calorieRange, confidenceLevelFromSource } from './confidence';

const day = {
  logicalDate: '2026-09-01',
  entries: [] as const,
};

describe('parseFoodMessageHeuristic', () => {
  it('logs two slices as one item', () => {
    const parsed = parseFoodMessageHeuristic('2 slices marbys wheat', day);
    expect(parsed.operations).toEqual([
      expect.objectContaining({
        type: 'ADD_FOOD',
        query: "Marby's Wheat Bread",
        quantity: 2,
        unit: 'slices',
      }),
    ]);
  });

  it('splits a shared half-tablespoon across two spreads', () => {
    const parsed = parseFoodMessageHeuristic('1/2 tbsp nutella and skippy', day);
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.operations[0]).toMatchObject({ query: 'Nutella', quantity: 0.5, unit: 'tbsp' });
    expect(parsed.operations[1]).toMatchObject({
      query: 'Skippy Peanut Butter',
      quantity: 0.5,
      unit: 'tbsp',
    });
  });

  it('stores 150g rice rather than a generic serving', () => {
    const parsed = parseFoodMessageHeuristic('150g rice', day);
    expect(parsed.operations[0]).toMatchObject({ query: 'rice', quantity: 150, unit: 'g' });
  });

  it('assigns multiple meals in one message', () => {
    const parsed = parseFoodMessageHeuristic('breakfast 2 eggs. lunch 150g rice', day);
    expect(parsed.operations[0]).toMatchObject({ meal: 'breakfast', query: 'eggs' });
    expect(parsed.operations[1]).toMatchObject({ meal: 'lunch', query: 'rice', quantity: 150 });
  });

  it('does not split mackerel meat into a second food', () => {
    const parsed = parseFoodMessageHeuristic('1 small mackerel, about 120 grams of meat', day);
    expect(parsed.operations).toHaveLength(1);
    expect(parsed.operations[0]).toMatchObject({ quantity: 120, unit: 'grams' });
    expect(parsed.operations[0]?.query).toMatch(/mackerel/i);
  });

  it('updates existing rice instead of adding another', () => {
    const parsed = parseFoodMessageHeuristic('actually rice was 170g', {
      logicalDate: '2026-09-01',
      entries: [{ id: '1', displayName: 'Rice', mealSlot: 'hapunan', quantity: 200, unit: 'g' }],
    });
    expect(parsed.operations).toEqual([
      expect.objectContaining({ type: 'UPDATE_FOOD', target_hint: 'rice', quantity: 170, unit: 'g' }),
    ]);
  });

  it('removes the named drink', () => {
    const parsed = parseFoodMessageHeuristic('remove the Coke', {
      logicalDate: '2026-09-01',
      entries: [{ id: '1', displayName: 'Coke', mealSlot: 'hapunan', quantity: 1 }],
    });
    expect(parsed.operations[0]).toMatchObject({ type: 'DELETE_FOOD', target_hint: 'Coke' });
  });

  it('halves a logged turon', () => {
    const parsed = parseFoodMessageHeuristic('I only ate half the turon', {
      logicalDate: '2026-09-01',
      entries: [{ id: '1', displayName: 'Turon', mealSlot: 'meryenda', quantity: 1 }],
    });
    expect(parsed.operations[0]).toMatchObject({
      type: 'UPDATE_FOOD',
      target_hint: 'turon',
      quantity_multiplier: 0.5,
    });
  });

  it('starts a new day without delete operations', () => {
    const parsed = parseFoodMessageHeuristic('new day', {
      logicalDate: '2026-09-01',
      entries: [{ id: '1', displayName: 'Rice', mealSlot: 'almusal', quantity: 1 }],
    });
    expect(parsed.operations).toEqual([{ type: 'START_NEW_DAY' }]);
  });

  it('copies yesterday breakfast then changes eggs', () => {
    const parsed = parseFoodMessageHeuristic('same breakfast as yesterday but two eggs', day);
    expect(parsed.operations[0]).toMatchObject({
      type: 'COPY_MEAL',
      source_date: '2026-08-31',
      source_meal: 'almusal',
    });
    expect(parsed.operations[1]).toMatchObject({ type: 'UPDATE_FOOD', target_hint: 'eggs', quantity: 2 });
  });

  it('copies Monday lunch', () => {
    const parsed = parseFoodMessageHeuristic("copy Monday's lunch", {
      logicalDate: '2026-09-01',
      entries: [],
    });
    expect(parsed.operations[0]).toMatchObject({
      type: 'COPY_MEAL',
      source_meal: 'tanghalian',
      source_date: '2026-08-31',
    });
  });

  it('copies a whole yesterday as COPY_DAY', () => {
    const parsed = parseFoodMessageHeuristic('copy yesterday', day);
    expect(parsed.operations).toEqual([
      expect.objectContaining({ type: 'COPY_DAY', source_date: '2026-08-31' }),
    ]);
  });
});

describe('extractStatedNutrition', () => {
  it('reads user-stated label numbers in code, not from a model', () => {
    expect(extractStatedNutrition('Athlene is 123 calories and 22g protein per scoop')).toEqual({
      kcal: 123,
      protein_g: 22,
    });
  });
});

describe('calculateDailyNutrition', () => {
  it('sums stored records and splits verified vs estimated ranges', () => {
    const totals = calculateDailyNutrition([
      {
        kcal: '100',
        protein_g: '10',
        carbs_g: '10',
        fat_g: '2',
        source: 'user',
        confidence: '1',
        verified: true,
      },
      {
        kcal: '100',
        protein_g: '5',
        carbs_g: '20',
        fat_g: '1',
        source: 'llm',
        confidence: '0.4',
      },
    ]);
    expect(totals.calories).toBe(200);
    expect(totals.protein_g).toBe(15);
    expect(totals.verified_calories).toBe(100);
    expect(totals.estimated_calories).toBe(100);
    expect(totals.estimated_low).toBe(180);
    expect(totals.estimated_high).toBe(220);
  });

  it('ignores tombstoned rows', () => {
    const totals = calculateDailyNutrition([
      {
        kcal: '50',
        protein_g: '0',
        carbs_g: '0',
        fat_g: '0',
        source: 'ph_core',
        confidence: '0.9',
        deleted_at: '2026-09-01T00:00:00.000Z',
      },
    ]);
    expect(totals.calories).toBe(0);
  });
});

describe('confidence and energy balance', () => {
  it('keeps verified calories exact', () => {
    expect(confidenceLevelFromSource({ source: 'user', confidence: 1, verified: true })).toBe('VERIFIED');
    expect(calorieRange(78, 'VERIFIED')).toEqual({ calories: 78, caloriesLow: 78, caloriesHigh: 78 });
  });

  it('shows expenditure as a range instead of net calories', () => {
    const balance = estimateEnergyBalance({
      intakeKcal: 2300,
      intakeLow: 2180,
      intakeHigh: 2480,
      expenditureKcal: 2850,
      expenditureLow: 2700,
      expenditureHigh: 3000,
    });
    expect(balance.balanceLow).toBe(2180 - 3000);
    expect(balance.balanceHigh).toBe(2480 - 2700);
  });
});
