import { describe, expect, it, vi } from 'vitest';
import { memoryResolveCatalog, phCoreToCatalog } from './catalog';
import type { CatalogFood } from './catalog';
import { yamlPhCoreCatalog } from './catalog-yaml';
import { loadPhCoreYaml } from './ph-core/io';
import { createResolveQueryCache, resolveFood, shouldAutoPick } from './resolve';
import type { NormalizedFood } from './types';

const USER = 'user-ch08';

function nutella(): NormalizedFood {
  return {
    name: 'Nutella',
    brand: 'Ferrero',
    barcode: '3017620422003',
    per100g: {
      kcal: 539,
      protein_g: 6.3,
      carbs_g: 57.5,
      fat_g: 30.9,
      fiber_g: 0,
      sugar_g: 56.3,
      sodium_mg: 42.8,
    },
    servings: [{ label: '100 g', grams: 100, isDefault: true }],
    source: 'off',
    sourceId: '3017620422003',
    confidence: 0.8,
    attribution: 'Open Food Facts',
  };
}

function userRice(): CatalogFood {
  const kanin = phCoreToCatalog(
    loadPhCoreYaml().foods.find((food) => food.id === 'kanin-white-cooked')!,
  );
  return {
    ...kanin,
    id: 'user-rice-1',
    source: 'user',
    sourceId: null,
    name: 'My leftover kanin',
    createdBy: USER,
  };
}

describe('resolveFood', () => {
  it('returns PH core rice for 2 tasa kanin, offline, with 400 g', async () => {
    const searchOff = vi.fn();
    const searchUsda = vi.fn();
    const lookupOffBarcode = vi.fn();

    const results = await resolveFood({ text: '2 tasa kanin' }, USER, {
      catalog: yamlPhCoreCatalog(),
      network: { searchOff, searchUsda, lookupOffBarcode },
    });

    const top = results[0];
    expect(top).toBeDefined();
    expect(top?.source).toBe('ph_core');
    expect(top?.sourceId).toBe('kanin-white-cooked');
    expect(top?.foodId).toBe('kanin-white-cooked');
    expect(top?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(top?.rankScore).toBeGreaterThanOrEqual(0.85);
    expect(top?.portion.grams).toBe(400);
    expect(top?.portion.kcal).toBeCloseTo(520, 5);
    expect(top?.whyMatched.toLowerCase()).toContain('kanin');
    expect(searchOff).not.toHaveBeenCalled();
    expect(searchUsda).not.toHaveBeenCalled();
    expect(lookupOffBarcode).not.toHaveBeenCalled();
    expect(shouldAutoPick(results)).toBe(true);
  });

  it('maps Taglish aliases rice and sinaing to the same PH core rice', async () => {
    const catalog = yamlPhCoreCatalog();
    const rice = await resolveFood({ text: 'rice' }, USER, { catalog });
    const sinaing = await resolveFood({ text: 'sinaing' }, USER, { catalog });
    const kanin = await resolveFood({ text: 'kanin' }, USER, { catalog });

    expect(rice[0]?.sourceId).toBe('kanin-white-cooked');
    expect(sinaing[0]?.sourceId).toBe('kanin-white-cooked');
    expect(kanin[0]?.sourceId).toBe('kanin-white-cooked');
  });

  it('still hits rice on a close misspelling', async () => {
    const results = await resolveFood({ text: 'kannin' }, USER, {
      catalog: yamlPhCoreCatalog(),
    });
    expect(results[0]?.sourceId).toBe('kanin-white-cooked');
  });

  it('applies malaki / maliit portion multipliers', async () => {
    const catalog = yamlPhCoreCatalog();
    const malaki = await resolveFood({ text: 'malaki tasa kanin' }, USER, { catalog });
    const maliit = await resolveFood({ text: 'maliit tasa kanin' }, USER, { catalog });
    expect(malaki[0]?.portion.grams).toBeCloseTo(260, 5);
    expect(maliit[0]?.portion.grams).toBeCloseTo(140, 5);
  });

  it("ranks the user's own food above PH core for the same alias", async () => {
    const kanin = phCoreToCatalog(
      loadPhCoreYaml().foods.find((food) => food.id === 'kanin-white-cooked')!,
    );
    const results = await resolveFood({ text: 'kanin' }, USER, {
      catalog: memoryResolveCatalog({ foods: [userRice(), kanin] }),
    });
    expect(results[0]?.source).toBe('user');
    expect(results[0]?.foodId).toBe('user-rice-1');
    expect(results[1]?.source).toBe('ph_core');
  });

  it('looks up barcodes on Open Food Facts first and never calls USDA', async () => {
    const searchUsda = vi.fn(async () => {
      throw new Error('USDA should not be called for barcodes');
    });
    const lookupOffBarcode = vi.fn(async () => nutella());
    const searchOff = vi.fn();

    const results = await resolveFood({ text: '3017620422003' }, USER, {
      catalog: memoryResolveCatalog({ foods: [] }),
      network: { lookupOffBarcode, searchUsda, searchOff },
    });

    expect(results[0]?.name).toBe('Nutella');
    expect(results[0]?.source).toBe('off');
    expect(results[0]?.barcode).toBe('3017620422003');
    expect(lookupOffBarcode).toHaveBeenCalledTimes(1);
    expect(searchUsda).not.toHaveBeenCalled();
    expect(searchOff).not.toHaveBeenCalled();
  });

  it('does not hit the network on a repeat query for the same user', async () => {
    const lookupOffBarcode = vi.fn(async () => nutella());
    const searchUsda = vi.fn();
    const deps = {
      catalog: memoryResolveCatalog({ foods: [] }),
      network: { lookupOffBarcode, searchUsda },
      queryCache: createResolveQueryCache(),
    };

    await resolveFood({ barcode: '3017620422003' }, USER, deps);
    await resolveFood({ barcode: '3017620422003' }, USER, deps);

    expect(lookupOffBarcode).toHaveBeenCalledTimes(1);
    expect(searchUsda).not.toHaveBeenCalled();
  });
});
