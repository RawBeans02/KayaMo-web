import { describe, expect, it, vi } from 'vitest';
import { noopLimiter } from './limiter';
import { getUsdaFood, searchUsda } from './usda';
import usdaSearchFixture from './fixtures/usda-search-chicken-breast.json';
import usdaDetailFixture from './fixtures/usda-food-detail.json';
import usdaBrandedFixture from './fixtures/usda-food-branded-detail.json';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('USDA adapter', () => {
  it('normalizes a chicken breast search and prefers Foundation', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      expect(input).toContain('api.nal.usda.gov/fdc/v1/foods/search');
      expect(input).toContain('api_key=test-key');
      return jsonResponse(usdaSearchFixture);
    });

    const results = await searchUsda('chicken breast', {
      apiKey: 'test-key',
      fetch: fetchMock,
      limiter: noopLimiter,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top?.source).toBe('usda_fdc');
    expect(top?.name.toLowerCase()).toContain('chicken');
    expect(top?.name.toLowerCase()).toContain('breast');
    expect(top?.sourceId).toBe('331960');
    expect(top?.confidence).toBe(0.9);
    expect(top?.per100g.kcal).toBeGreaterThan(100);
    expect(top?.per100g.protein_g).toBeGreaterThan(20);
    expect(top?.servings.some((s) => s.grams === 100)).toBe(true);

    const branded = results.find((food) => food.sourceId === '2187885');
    expect(branded?.brand).toBe('Giant Eagle');
    expect(branded?.per100g.protein_g).toBeCloseTo(20.4, 3);
    expect(branded?.barcode).toBe('030034086411');
  });

  it('maps a recorded get-by-fdcId payload', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      expect(input).toContain('/food/171140');
      return jsonResponse(usdaDetailFixture);
    });

    const food = await getUsdaFood(171140, {
      apiKey: 'test-key',
      fetch: fetchMock,
      limiter: noopLimiter,
    });
    expect(food?.name.toLowerCase()).toContain('chicken');
    expect(food?.per100g.kcal).toBe(157);
    expect(food?.per100g.protein_g).toBeCloseTo(32.06, 2);
    expect(food?.servings.some((s) => s.label === '1 piece' && s.grams === 181)).toBe(true);
  });

  it('preserves USDA branded foodNutrients already standardized per 100 g', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(usdaBrandedFixture));
    const food = await getUsdaFood(2187885, {
      apiKey: 'test-key',
      fetch: fetchMock,
      limiter: noopLimiter,
    });
    expect(food?.per100g.kcal).toBeCloseTo(165, 3);
    expect(food?.servings.some((s) => s.label === '1 Chicken Breast' && s.grams === 284)).toBe(true);
  });

  it('does not call the network when the query is empty', async () => {
    const fetchMock = vi.fn();
    await expect(
      searchUsda('  ', { apiKey: 'test-key', fetch: fetchMock, limiter: noopLimiter }),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
