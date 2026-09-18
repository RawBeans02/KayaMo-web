import { cacheOnFirstHit, type CanonicalFoodStore } from './cache';
import { catalogNames, type CatalogFood, type ResolveCatalog } from './catalog';
import { resolvePortion, type ResolvedPortion } from './portion';
import { parseFoodQuery, type FoodQuery, type ParsedFoodQuery } from './query-parse';
import {
  compareScored,
  LLM_CONFIDENCE_CAP,
  rankScore,
  shouldAutoPick,
  sourcePriorityFor,
  type ResolveSource,
} from './score';
import { bestAliasMatch, describeMatch } from './trigram';
import type { FoodServing, NormalizedFood, NutrientsPer100g } from './types';

export type FoodCandidate = {
  foodId: string;
  name: string;
  brand?: string;
  barcode?: string;
  source: ResolveSource;
  sourceId?: string;
  confidence: number;
  rankScore: number;
  matchScore: number;
  timesLogged: number;
  whyMatched: string;
  per100g: NutrientsPer100g;
  servings: FoodServing[];
  portion: ResolvedPortion;
  attribution?: string;
  estimate?: boolean;
  verified?: boolean;
  /** Carried from CatalogFood: the person edited these numbers on this device. */
  locallyEdited?: boolean;
};

export type ResolveNetwork = {
  searchOff?: (query: string) => Promise<NormalizedFood[]>;
  lookupOffBarcode?: (barcode: string) => Promise<NormalizedFood | null>;
  searchUsda?: (query: string) => Promise<NormalizedFood[]>;
};

export type LlmEstimate = Pick<
  FoodCandidate,
  'foodId' | 'name' | 'per100g' | 'servings' | 'confidence' | 'matchScore' | 'whyMatched'
> & {
  brand?: string;
  barcode?: string;
  sourceId?: string;
  attribution?: string;
};

export type ResolveQueryCache = {
  get(key: string): FoodCandidate[] | undefined;
  set(key: string, value: FoodCandidate[]): void;
};

export type ResolveDeps = {
  catalog: ResolveCatalog;
  cache?: CanonicalFoodStore;
  network?: ResolveNetwork;
  estimateWithLlm?: (query: ParsedFoodQuery) => Promise<LlmEstimate | null>;
  queryCache?: ResolveQueryCache;
};

type ScoreOpts = {
  fromCache?: boolean;
  barcode?: boolean;
  isMyFood?: boolean;
};

export function createResolveQueryCache(max = 200): ResolveQueryCache {
  const map = new Map<string, FoodCandidate[]>();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      map.delete(key);
      map.set(key, hit);
      return hit.map((candidate) => ({ ...candidate, portion: { ...candidate.portion } }));
    },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      while (map.size > max) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
  };
}

function cacheKey(userId: string, parsed: ParsedFoodQuery): string {
  if (parsed.barcode) return `${userId}|b:${parsed.barcode}`;
  return `${userId}|t:${parsed.raw.toLowerCase()}`;
}

function toCandidate(
  food: CatalogFood,
  parsed: ParsedFoodQuery,
  match: { matchScore: number; why: string },
  timesLogged: number,
  opts: ScoreOpts,
): FoodCandidate {
  const isMyFood = opts.isMyFood ?? false;
  return {
    foodId: food.id,
    name: food.name,
    ...(food.brand ? { brand: food.brand } : {}),
    ...(food.barcode ? { barcode: food.barcode } : {}),
    source: food.source,
    ...(food.sourceId ? { sourceId: food.sourceId } : {}),
    confidence: food.confidence,
    rankScore: rankScore({
      source: food.source,
      matchScore: match.matchScore,
      timesLogged,
      fromCache: opts.fromCache,
      barcode: opts.barcode,
      isMyFood,
    }),
    matchScore: match.matchScore,
    timesLogged,
    whyMatched: match.why,
    per100g: food.per100g,
    servings: food.servings,
    portion: resolvePortion(parsed, food.servings, food.per100g.kcal),
    ...(food.attribution ? { attribution: food.attribution } : {}),
    ...(food.verified ? { verified: true } : {}),
  };
}

function scoreFoods(
  foods: CatalogFood[],
  parsed: ParsedFoodQuery,
  counts: Map<string, number>,
  opts: ScoreOpts,
): FoodCandidate[] {
  const scored: FoodCandidate[] = [];
  for (const food of foods) {
    if (opts.barcode) {
      scored.push(
        toCandidate(
          food,
          parsed,
          { matchScore: 1, why: `barcode ${parsed.barcode ?? food.barcode ?? ''}` },
          counts.get(food.id) ?? 0,
          opts,
        ),
      );
      continue;
    }
    const match = bestAliasMatch(parsed.name, catalogNames(food));
    if (!match) continue;
    scored.push(
      toCandidate(
        food,
        parsed,
        { matchScore: match.matchScore, why: describeMatch(parsed.name, match.alias, match.matchScore) },
        counts.get(food.id) ?? 0,
        opts,
      ),
    );
  }
  return scored;
}

function sortByScore(candidates: FoodCandidate[]): FoodCandidate[] {
  return candidates.slice().sort((a, b) =>
    compareScored(
      {
        rankScore: a.rankScore,
        matchScore: a.matchScore,
        sourcePriority: sourcePriorityFor(a.source, {
          barcode: a.source === 'off' && Boolean(a.barcode),
          fromCache: a.source === 'usda_fdc' || a.source === 'off',
          isMyFood: a.source === 'user',
        }),
        timesLogged: a.timesLogged,
        name: a.name,
      },
      {
        rankScore: b.rankScore,
        matchScore: b.matchScore,
        sourcePriority: sourcePriorityFor(b.source, {
          barcode: b.source === 'off' && Boolean(b.barcode),
          fromCache: b.source === 'usda_fdc' || b.source === 'off',
          isMyFood: b.source === 'user',
        }),
        timesLogged: b.timesLogged,
        name: b.name,
      },
    ),
  );
}

function dedupeCandidates(candidates: FoodCandidate[]): FoodCandidate[] {
  const seen = new Set<string>();
  const out: FoodCandidate[] = [];
  for (const candidate of sortByScore(candidates)) {
    const key = candidate.sourceId
      ? `${candidate.source}:${candidate.sourceId}`
      : `id:${candidate.foodId}`;
    if (seen.has(key) || seen.has(`id:${candidate.foodId}`)) continue;
    seen.add(key);
    seen.add(`id:${candidate.foodId}`);
    out.push(candidate);
  }
  return out;
}

async function maybeCache(food: NormalizedFood, store: CanonicalFoodStore | undefined) {
  if (!store) return null;
  try {
    return await cacheOnFirstHit(store, food);
  } catch {
    return null;
  }
}

function fromNormalized(
  food: NormalizedFood,
  parsed: ParsedFoodQuery,
  storedId: string | undefined,
  opts: ScoreOpts,
): FoodCandidate {
  const catalog: CatalogFood = {
    id: storedId ?? `ext:${food.source}:${food.sourceId}`,
    source: food.source,
    sourceId: food.sourceId,
    name: food.name,
    nameTl: [],
    aliases: [food.name, ...(food.brand ? [food.brand] : [])],
    brand: food.brand ?? null,
    barcode: food.barcode ?? null,
    per100g: food.per100g,
    confidence: food.confidence,
    servings: food.servings,
    createdBy: null,
    ...(food.attribution ? { attribution: food.attribution } : {}),
    ...(food.sourceNote ? { sourceNote: food.sourceNote } : {}),
  };
  if (opts.barcode) {
    return toCandidate(
      catalog,
      parsed,
      { matchScore: 1, why: `barcode ${parsed.barcode ?? food.barcode ?? ''}` },
      0,
      opts,
    );
  }
  const match = bestAliasMatch(parsed.name, catalogNames(catalog));
  return toCandidate(
    catalog,
    parsed,
    match
      ? { matchScore: match.matchScore, why: describeMatch(parsed.name, match.alias, match.matchScore) }
      : { matchScore: 0.5, why: `network name "${food.name}"` },
    0,
    opts,
  );
}

async function addNetwork(
  ranked: FoodCandidate[],
  parsed: ParsedFoodQuery,
  deps: ResolveDeps,
): Promise<FoodCandidate[]> {
  const network = deps.network;
  if (!network) return ranked;

  const merge = async (foods: NormalizedFood[], opts: ScoreOpts) => {
    const extra: FoodCandidate[] = [];
    for (const food of foods) {
      const stored = await maybeCache(food, deps.cache);
      extra.push(fromNormalized(food, parsed, stored?.id, opts));
    }
    return dedupeCandidates([...ranked, ...extra]);
  };

  if (parsed.barcode) {
    try {
      const hit = await network.lookupOffBarcode?.(parsed.barcode);
      if (hit) return merge([hit], { barcode: true, fromCache: false });
    } catch {
      // Keep local barcode hits if OFF is down.
    }
    return ranked;
  }

  try {
    const off = (await network.searchOff?.(parsed.name)) ?? [];
    ranked = await merge(off, { fromCache: false });
    if (shouldAutoPick(ranked)) return ranked;
  } catch {
    // USDA may still match.
  }

  try {
    const usda = (await network.searchUsda?.(parsed.name)) ?? [];
    ranked = await merge(usda, { fromCache: false });
  } catch {
    // Local + OFF results are enough to return.
  }

  return ranked;
}

/**
 * Ranked food candidates. Never a single answer.
 * Nutrition numbers never come from an LLM; `estimateWithLlm` is a last-resort
 * hook and is not called unless every earlier rung is empty.
 */
export async function resolveFood(
  query: FoodQuery,
  userId: string,
  deps: ResolveDeps,
): Promise<FoodCandidate[]> {
  const parsed = parseFoodQuery(query);
  if (!parsed.barcode && !parsed.name) return [];

  const key = cacheKey(userId, parsed);
  const cached = deps.queryCache?.get(key);
  if (cached) return cached;

  let ranked: FoodCandidate[] = [];

  if (parsed.barcode) {
    const local = await deps.catalog.getByBarcode(parsed.barcode, userId);
    const counts = await deps.catalog.getLogCounts(
      userId,
      local.map((food) => food.id),
    );
    ranked = dedupeCandidates(
      local.map((food) =>
        toCandidate(
          food,
          parsed,
          { matchScore: 1, why: `barcode ${parsed.barcode}` },
          counts.get(food.id) ?? 0,
          {
            barcode: true,
            fromCache: food.source === 'usda_fdc' || food.source === 'off',
            isMyFood: food.source === 'user' && food.createdBy === userId,
          },
        ),
      ),
    );
  } else {
    const local = await deps.catalog.searchLocal(parsed, userId);
    const counts = await deps.catalog.getLogCounts(
      userId,
      local.map((food) => food.id),
    );
    const mine = local.filter((food) => food.source === 'user' && food.createdBy === userId);
    const sharedUser = local.filter((food) => food.source === 'user' && food.createdBy !== userId);
    const phCore = local.filter((food) => food.source === 'ph_core');
    const cachedRemote = local.filter((food) => food.source === 'usda_fdc' || food.source === 'off');
    ranked = dedupeCandidates([
      ...scoreFoods(mine, parsed, counts, { isMyFood: true }),
      ...scoreFoods(phCore, parsed, counts, {}),
      ...scoreFoods(cachedRemote, parsed, counts, { fromCache: true }),
      ...scoreFoods(sharedUser, parsed, counts, { fromCache: true, isMyFood: false }),
    ]);
  }

  if (!shouldAutoPick(ranked) && deps.network) {
    ranked = await addNetwork(ranked, parsed, deps);
  }

  if (ranked.length === 0 && deps.estimateWithLlm) {
    const estimate = await deps.estimateWithLlm(parsed);
    if (estimate) {
      const confidence = Math.min(LLM_CONFIDENCE_CAP, estimate.confidence);
      ranked = [
        {
          foodId: estimate.foodId,
          name: estimate.name,
          ...(estimate.brand ? { brand: estimate.brand } : {}),
          ...(estimate.barcode ? { barcode: estimate.barcode } : {}),
          source: 'llm',
          ...(estimate.sourceId ? { sourceId: estimate.sourceId } : {}),
          confidence,
          rankScore: Math.min(
            LLM_CONFIDENCE_CAP,
            rankScore({ source: 'llm', matchScore: estimate.matchScore, timesLogged: 0 }),
          ),
          matchScore: estimate.matchScore,
          timesLogged: 0,
          whyMatched: estimate.whyMatched.includes('estimate')
            ? estimate.whyMatched
            : `${estimate.whyMatched}; estimate`,
          per100g: estimate.per100g,
          servings: estimate.servings,
          portion: resolvePortion(parsed, estimate.servings, estimate.per100g.kcal),
          ...(estimate.attribution ? { attribution: estimate.attribution } : {}),
          estimate: true,
        },
      ];
    }
  }

  const result = ranked.slice(0, 12);
  deps.queryCache?.set(key, result);
  return result;
}

export { shouldAutoPick };
