import { describe, expect, it, vi } from 'vitest';
import { searchExternalFoods } from './search';
import { noopLimiter } from './sources/limiter';
import off from './sources/fixtures/off-search-nutella.json';
import usda from './sources/fixtures/usda-search-chicken-breast.json';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
describe('independent food providers', () => {
  it('retains OFF results when USDA fails', async () => {
    const fetch = vi.fn(async (url: string) => url.includes('usda.gov') ? json({}, 503) : json(off));
    const foods = await searchExternalFoods('nutella', { usda: { apiKey: 'test', fetch, limiter: noopLimiter }, off: { fetch, limiter: noopLimiter } });
    expect(foods.some((food) => food.source === 'off')).toBe(true);
  });
  it('retains USDA results when OFF fails', async () => {
    const fetch = vi.fn(async (url: string) => url.includes('usda.gov') ? json(usda) : json({}, 503));
    const foods = await searchExternalFoods('chicken', { usda: { apiKey: 'test', fetch, limiter: noopLimiter }, off: { fetch, limiter: noopLimiter } });
    expect(foods.some((food) => food.source === 'usda_fdc')).toBe(true);
  });
  it('reports total outage instead of presenting it as no matching food', async () => {
    const fetch = vi.fn(async () => json({}, 503));
    await expect(searchExternalFoods('tofu', { usda: { apiKey: 'test', fetch, limiter: noopLimiter }, off: { fetch, limiter: noopLimiter } })).rejects.toThrow('temporarily unavailable');
  });
});
