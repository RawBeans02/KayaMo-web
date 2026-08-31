import { atwaterDelta } from '@kayamo/food/ph-core';
import { describe, expect, it } from 'vitest';
import {
  ATWATER_TOLERANCE,
  atwaterDeltaFromMacros,
  macrosOffByMoreThanFivePercent,
} from './atwater-check';

const fixture = {
  id: 'adobo',
  name: 'Adobo',
  name_tl: ['adobo'],
  category: 'ulam' as const,
  per100g: {
    kcal: 160,
    protein: 16,
    carbs: 4,
    fat: 8,
    fiber: 0,
    sugar: 1,
    sodium_mg: 400,
  },
  servings: [{ label: '1 serving', grams: 150, is_default: true }],
  typical_prep: 'braise',
  source_note: 'USDA chicken + soy assumption',
  confidence: 0.52,
  verified: false,
};

describe('atwaterDeltaFromMacros', () => {
  it('matches @kayamo/food atwaterDelta on a PH-core shaped row', () => {
    expect(
      atwaterDeltaFromMacros({
        kcal: fixture.per100g.kcal,
        protein: fixture.per100g.protein,
        carbs: fixture.per100g.carbs,
        fat: fixture.per100g.fat,
      }),
    ).toBeCloseTo(atwaterDelta(fixture), 10);
  });

  it('flags a row more than 5% off 4/4/9', () => {
    expect(
      macrosOffByMoreThanFivePercent({ kcal: 500, protein: 10, carbs: 10, fat: 10 }),
    ).toBe(true);
    expect(ATWATER_TOLERANCE).toBe(0.05);
  });

  it('passes a consistent 4/4/9 row', () => {
    expect(
      macrosOffByMoreThanFivePercent({ kcal: 160, protein: 16, carbs: 4, fat: 8 }),
    ).toBe(false);
  });
});
