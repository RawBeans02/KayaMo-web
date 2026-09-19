import type { PhCoreFood } from './ph-core/schema';
import type { ParsedFoodQuery } from './query-parse';
import type { ResolveSource } from './score';
import { bestAliasMatch } from './trigram';
import type { FoodServing, NutrientsPer100g } from './types';

export type CatalogFood = {
  id: string;
  source: ResolveSource;
  sourceId: string | null;
  name: string;
  nameTl: string[];
  aliases: string[];
  brand: string | null;
  barcode: string | null;
  per100g: NutrientsPer100g;
  confidence: number;
  servings: FoodServing[];
  createdBy: string | null;
  verified?: boolean;
  attribution?: string;
  sourceNote?: string;
  /** The numbers came from this browser's Verify overlay, not from `source`. */
  locallyEdited?: boolean;
};

export type ResolveCatalog = {
  searchLocal(query: ParsedFoodQuery, userId: string): Promise<CatalogFood[]>;
  getByBarcode(barcode: string, userId: string): Promise<CatalogFood[]>;
  getLogCounts(userId: string, foodIds: string[]): Promise<Map<string, number>>;
};

export function catalogNames(food: CatalogFood): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of [food.name, ...food.nameTl, ...food.aliases]) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return names;
}

export function phCoreToCatalog(food: PhCoreFood): CatalogFood {
  return {
    id: food.id,
    source: 'ph_core',
    sourceId: food.id,
    name: food.name,
    nameTl: food.name_tl,
    aliases: food.name_tl,
    brand: null,
    barcode: null,
    per100g: {
      kcal: food.per100g.kcal,
      protein_g: food.per100g.protein,
      carbs_g: food.per100g.carbs,
      fat_g: food.per100g.fat,
      fiber_g: food.per100g.fiber,
      sugar_g: food.per100g.sugar,
      sodium_mg: food.per100g.sodium_mg,
    },
    confidence: food.confidence,
    servings: food.servings.map((serving) => ({
      label: serving.label,
      grams: serving.grams,
      isDefault: serving.is_default === true,
    })),
    createdBy: null,
    ...(food.verified ? { verified: true } : {}),
    sourceNote: food.source_note,
  };
}

export function memoryResolveCatalog(opts: {
  foods: CatalogFood[];
  logCounts?: Record<string, number> | Map<string, number>;
}): ResolveCatalog {
  const foods = opts.foods;
  const counts =
    opts.logCounts instanceof Map ? opts.logCounts : new Map(Object.entries(opts.logCounts ?? {}));

  return {
    async searchLocal(query) {
      if (!query.name) return [];
      return foods.filter((food) => bestAliasMatch(query.name, catalogNames(food)));
    },
    async getByBarcode(barcode) {
      return foods.filter((food) => food.barcode === barcode);
    },
    async getLogCounts(_userId, foodIds) {
      const next = new Map<string, number>();
      for (const id of foodIds) {
        next.set(id, counts.get(id) ?? 0);
      }
      return next;
    },
  };
}
