import { memoryResolveCatalog, type CatalogFood } from './catalog';
import { scaleNutrientSnapshot, toConfidenceString, toNutrientString, type NutrientSnapshot } from './numeric';
import { resolveFood, type FoodCandidate } from './resolve';
import type { ResolveSource } from './score';
import type { NutrientsPer100g } from './types';
export { normalizedFoodSchema, type NormalizedFood } from './types';

export { foodRowToCatalog } from './catalog-supabase';
export { memoryResolveCatalog, type CatalogFood };
export { resolveFood, type FoodCandidate };
export type { NutrientSnapshot };
export { toConfidenceString };

export const SEARCH_DEBOUNCE_MS = 280;
export const SEARCH_HISTORY_LIMIT = 20;

export type SourceBadge = 'PH' | 'Brand' | 'USDA' | 'Yours';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function persistableFoodId(id: string): string | null {
  return UUID_RE.test(id) ? id : null;
}

export function sourceBadge(source: ResolveSource): SourceBadge | null {
  if (source === 'ph_core') return 'PH';
  if (source === 'off') return 'Brand';
  if (source === 'usda_fdc') return 'USDA';
  if (source === 'user') return 'Yours';
  return null;
}

export function isEstimateResult(
  candidate: Pick<FoodCandidate, 'source' | 'estimate'>,
): boolean {
  return candidate.estimate === true || candidate.source === 'llm';
}

export function showsVerifiedCheck(
  candidate: Pick<FoodCandidate, 'verified' | 'source' | 'estimate'>,
): boolean {
  if (isEstimateResult(candidate)) return false;
  return candidate.verified === true;
}

export function servingKcal(candidate: Pick<FoodCandidate, 'portion'>): number {
  return Math.round(candidate.portion.kcal);
}

export function candidateDedupeKey(
  candidate: Pick<FoodCandidate, 'foodId' | 'source' | 'sourceId'>,
): string {
  if (candidate.sourceId) return `${candidate.source}:${candidate.sourceId}`;
  return `id:${candidate.foodId}`;
}

export function mergeCandidatesById(
  primary: readonly FoodCandidate[],
  extra: readonly FoodCandidate[],
): FoodCandidate[] {
  const seen = new Set<string>();
  const out: FoodCandidate[] = [];
  for (const candidate of [...primary, ...extra]) {
    const key = candidateDedupeKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

/** Remote hits that were not already shown in the local-first list. */
export function remoteOnlyCandidates(
  local: readonly FoodCandidate[],
  full: readonly FoodCandidate[],
): FoodCandidate[] {
  const seen = new Set(local.map(candidateDedupeKey));
  return full.filter((candidate) => !seen.has(candidateDedupeKey(candidate)));
}

export type SearchHistoryEntry = NutrientSnapshot & {
  foodId: string;
  name: string;
  loggedAtMs: number;
  quantity: string;
  grams: string;
  servingId: string | null;
  servingLabel: string | null;
  source: string;
  resolvedVia: string;
  confidence: string;
};

export function recentLoggedFoods(
  entries: readonly SearchHistoryEntry[],
  limit = SEARCH_HISTORY_LIMIT,
): SearchHistoryEntry[] {
  const seen = new Set<string>();
  const out: SearchHistoryEntry[] = [];
  const sorted = entries.slice().sort((a, b) => b.loggedAtMs - a.loggedAtMs);
  for (const entry of sorted) {
    if (!entry.foodId || seen.has(entry.foodId)) continue;
    seen.add(entry.foodId);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

export function frequentLoggedFoods(
  entries: readonly SearchHistoryEntry[],
  limit = SEARCH_HISTORY_LIMIT,
): SearchHistoryEntry[] {
  const groups = new Map<string, SearchHistoryEntry[]>();
  for (const entry of entries) {
    if (!entry.foodId) continue;
    const list = groups.get(entry.foodId) ?? [];
    list.push(entry);
    groups.set(entry.foodId, list);
  }
  return [...groups.values()]
    .map((group) => {
      const last = group.reduce((a, b) => (a.loggedAtMs >= b.loggedAtMs ? a : b));
      return { last, count: group.length, recency: last.loggedAtMs };
    })
    .sort((a, b) => b.count - a.count || b.recency - a.recency || a.last.name.localeCompare(b.last.name))
    .slice(0, limit)
    .map((row) => row.last);
}

export function nutrientsFromPer100g(per100g: NutrientsPer100g, grams: number): NutrientSnapshot {
  return scaleNutrientSnapshot(
    {
      kcal: toNutrientString(per100g.kcal),
      protein_g: toNutrientString(per100g.protein_g),
      carbs_g: toNutrientString(per100g.carbs_g),
      fat_g: toNutrientString(per100g.fat_g),
      fiber_g: toNutrientString(per100g.fiber_g),
      sugar_g: toNutrientString(per100g.sugar_g),
      sodium_mg: toNutrientString(per100g.sodium_mg),
    },
    grams,
  );
}

export function logCountsFromHistory(
  entries: readonly Pick<SearchHistoryEntry, 'foodId'>[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.foodId) continue;
    counts.set(entry.foodId, (counts.get(entry.foodId) ?? 0) + 1);
  }
  return counts;
}

export async function resolveFromCatalogFoods(
  query: string,
  userId: string,
  foods: CatalogFood[],
  logCounts?: Map<string, number>,
): Promise<FoodCandidate[]> {
  const text = query.trim();
  if (!text) return [];
  return resolveFood(
    { text },
    userId,
    { catalog: memoryResolveCatalog({ foods, logCounts }) },
  );
}
