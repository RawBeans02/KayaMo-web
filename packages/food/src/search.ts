import { cacheOnFirstHit, type CanonicalFoodStore } from './cache';
import { looksLikeBarcode, mergeCandidates } from './normalize';
import { lookupOffBarcode, searchOff, type OffDeps } from './sources/off';
import { searchUsda, type UsdaDeps } from './sources/usda';
import type { NormalizedFood } from './types';

export type SearchExternalDeps = {
  usda?: UsdaDeps;
  off?: OffDeps;
  cache?: CanonicalFoodStore;
};

async function cacheAll(foods: NormalizedFood[], store: CanonicalFoodStore | undefined): Promise<void> {
  if (!store) return;
  for (const food of foods) {
    try {
      await cacheOnFirstHit(store, food);
    } catch {
      // Search results still return if the local cache write fails.
    }
  }
}

export async function searchExternalFoods(
  query: string,
  deps: SearchExternalDeps = {},
): Promise<NormalizedFood[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (looksLikeBarcode(trimmed)) {
    const hit = await lookupOffBarcode(trimmed, deps.off);
    const foods = hit ? [hit] : [];
    await cacheAll(foods, deps.cache);
    return foods;
  }

  // A provider outage must not hide results from the other source.
  const [usdaResult, offResult] = await Promise.allSettled([
    searchUsda(trimmed, deps.usda),
    searchOff(trimmed, deps.off),
  ]);
  if (usdaResult.status === 'rejected' && offResult.status === 'rejected') {
    throw new Error('Food search providers are temporarily unavailable.');
  }
  const usda = usdaResult.status === 'fulfilled' ? usdaResult.value : [];
  const off = offResult.status === 'fulfilled' ? offResult.value : [];

  const foods = mergeCandidates([...usda, ...off]);
  await cacheAll(foods, deps.cache);
  return foods;
}
