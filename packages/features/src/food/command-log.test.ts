import { describe, expect, it } from 'vitest';
import type { FoodCandidate } from '@kayamo/food/search-ui';
import {
  clampSelectedIndex,
  catalogForCommandLog,
  cycleMealSlot,
  mealSlotFromDigit,
  quantityFromCandidate,
  servingIdForLabel,
  toLogInputFromCandidate,
} from './command-log-model';

function candidate(partial: Partial<FoodCandidate> = {}): FoodCandidate {
  return {
    foodId: '11111111-1111-1111-1111-111111111111',
    name: 'Kanin',
    source: 'ph_core',
    confidence: 0.52,
    rankScore: 0.9,
    matchScore: 1,
    timesLogged: 2,
    whyMatched: 'name',
    per100g: {
      kcal: 130,
      protein_g: 2.7,
      carbs_g: 28,
      fat_g: 0.3,
      fiber_g: 0.4,
      sugar_g: 0.1,
      sodium_mg: 1,
    },
    servings: [{ label: 'tasa', grams: 150, isDefault: true }],
    portion: {
      amount: 1,
      unit: 'tasa',
      grams: 150,
      servingLabel: 'tasa',
      kcal: 195,
    },
    ...partial,
  };
}

describe('command log helpers', () => {
  it('maps digit keys onto meal slots and cycles with brackets', () => {
    expect(mealSlotFromDigit('1')).toBe('almusal');
    expect(mealSlotFromDigit('4')).toBe('hapunan');
    expect(cycleMealSlot('almusal', 1)).toBe('tanghalian');
    expect(cycleMealSlot('almusal', -1)).toBe('hapunan');
  });

  it('scales the default serving when Tab overrides quantity', () => {
    const qty = quantityFromCandidate(candidate(), 2);
    expect(qty.quantity).toBe('2');
    expect(qty.grams).toBe('300');
    expect(qty.servingLabel).toBe('2 × tasa');
  });

  it('builds the same search log payload the PWA search path uses', () => {
    const input = toLogInputFromCandidate({
      userId: 'user-1',
      mealSlot: 'tanghalian',
      candidate: candidate(),
      servingId: 'serving-1',
      timeZone: 'Asia/Manila',
      dayStartsAt: '00:00:00',
    });
    expect(input).toMatchObject({
      userId: 'user-1',
      mealSlot: 'tanghalian',
      foodId: '11111111-1111-1111-1111-111111111111',
      foodName: 'Kanin',
      quantity: '1',
      grams: '150',
      inputMethod: 'search',
      source: 'ph_core',
      resolvedVia: 'ph_core',
      servingId: 'serving-1',
      servingLabel: 'tasa',
      timeZone: 'Asia/Manila',
      dayStartsAt: '00:00:00',
    });
    expect(Number(input?.kcal)).toBeCloseTo(195, 5);
  });

  it('refuses to log a candidate without a persistable food id', () => {
    expect(
      toLogInputFromCandidate({
        userId: 'user-1',
        mealSlot: 'almusal',
        candidate: candidate({ foodId: 'llm-estimate' }),
        servingId: null,
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
      }),
    ).toBeNull();
  });

  it('picks the default serving id when the portion label is missing', () => {
    expect(
      servingIdForLabel(
        [
          { id: 'a', label: 'piraso', is_default: false },
          { id: 'b', label: 'tasa', is_default: true },
        ],
        null,
      ),
    ).toBe('b');
  });

  it('clamps the highlighted row', () => {
    expect(clampSelectedIndex(9, 3)).toBe(2);
    expect(clampSelectedIndex(-1, 3)).toBe(0);
    expect(clampSelectedIndex(0, 0)).toBe(0);
  });

  it('keeps PH core and user foods, drops USDA and Open Food Facts', () => {
    const per100g = {
      kcal: 100,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    };
    const servings = [{ label: '100 g', grams: 100, isDefault: true }];
    const kept = catalogForCommandLog([
      {
        id: 'ph',
        name: 'Kanin',
        source: 'ph_core',
        sourceId: null,
        nameTl: [],
        aliases: [],
        brand: null,
        barcode: null,
        per100g,
        confidence: 0.5,
        servings,
        createdBy: null,
      },
      {
        id: 'mine',
        name: 'Lutong bahay',
        source: 'user',
        sourceId: null,
        nameTl: [],
        aliases: [],
        brand: null,
        barcode: null,
        per100g,
        confidence: 1,
        servings,
        createdBy: 'user-1',
      },
      {
        id: 'usda',
        name: 'Rice, white, cooked',
        source: 'usda_fdc',
        sourceId: '123',
        nameTl: [],
        aliases: [],
        brand: null,
        barcode: null,
        per100g,
        confidence: 0.8,
        servings,
        createdBy: null,
      },
      {
        id: 'off',
        name: 'Lucky Me',
        source: 'off',
        sourceId: '456',
        nameTl: [],
        aliases: [],
        brand: 'Lucky Me',
        barcode: null,
        per100g,
        confidence: 0.7,
        servings,
        createdBy: null,
      },
    ]);
    expect(kept.map((row) => row.id)).toEqual(['ph', 'mine']);
  });
});
