import { describe, expect, it } from 'vitest';
import { mapOffProduct } from './sources/off';
import { mapUsdaFood } from './sources/usda';

describe('international nutrition normalization safeguards', () => {
  it('rejects OFF label-only energy without a per-100g basis', () => {
    expect(mapOffProduct({ product_name: 'Example', nutriments: {
      'energy-kcal': 100, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1,
    } })).toBeNull();
  });
  it('rejects missing macros instead of inventing zero', () => {
    expect(mapOffProduct({ product_name: 'Example', nutriments: {
      'energy-kcal_100g': 100, proteins_100g: 1, carbohydrates_100g: 1,
    } })).toBeNull();
    expect(mapUsdaFood({ fdcId: 1, description: 'Example', foodNutrients: [
      { nutrientId: 1008, value: 100, unitName: 'kcal' },
    ] })).toBeNull();
  });
  it('accepts explicit zero macros', () => {
    expect(mapOffProduct({ product_name: 'Water', nutriments: {
      'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0,
    } })?.per100g.kcal).toBe(0);
  });
});
