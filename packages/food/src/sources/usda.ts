import { USDA_SOURCE_NOTE } from '../licenses';
import {
  displayName,
  kjToKcal,
  normalizeBarcode,
  toGrams,
  withDefaultServings,
} from '../normalize';
import { FoodSourceError, type FoodServing, type NormalizedFood, type NutrientsPer100g } from '../types';
import type { SourceHttpDeps } from './http';
import { requestJson } from './http';
import { usdaHourlyLimiter } from './limiter';

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const FOOD_URL = 'https://api.nal.usda.gov/fdc/v1/food';

const ENERGY_KCAL_IDS = [1008, 2047, 2048];
const ENERGY_KJ_ID = 1062;
const PROTEIN_ID = 1003;
const CARB_ID = 1005;
const FAT_ID = 1004;
const FIBER_ID = 1079;
const SUGAR_IDS = [2000, 1063];
const SODIUM_ID = 1093;

const DATA_TYPE_RANK: Record<string, number> = {
  Foundation: 0,
  'SR Legacy': 1,
  'Survey (FNDDS)': 2,
  Branded: 3,
};

const DATA_TYPE_CONFIDENCE: Record<string, number> = {
  Foundation: 0.9,
  'SR Legacy': 0.85,
  'Survey (FNDDS)': 0.75,
  Branded: 0.7,
};

export type UsdaDeps = SourceHttpDeps & {
  apiKey?: string;
};

type UsdaNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
  amount?: number;
  nutrient?: {
    id?: number;
    name?: string;
    unitName?: string;
  };
};

type UsdaPortion = {
  gramWeight?: number;
  amount?: number;
  modifier?: string | null;
  portionDescription?: string | null;
  measureUnit?: { name?: string | null } | null;
};

type UsdaFoodPayload = {
  fdcId?: number;
  description?: string;
  dataType?: string;
  brandName?: string | null;
  brandOwner?: string | null;
  gtinUpc?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
  householdServingFullText?: string | null;
  foodNutrients?: UsdaNutrient[];
  foodPortions?: UsdaPortion[];
};

type UsdaSearchPayload = {
  foods?: UsdaFoodPayload[];
};

function requireApiKey(deps: UsdaDeps): string {
  const key = deps.apiKey ?? process.env.USDA_FDC_API_KEY?.trim();
  if (!key) {
    throw new FoodSourceError('USDA_FDC_API_KEY is not set');
  }
  return key;
}

function httpDeps(deps: UsdaDeps): SourceHttpDeps {
  return {
    fetch: deps.fetch,
    limiter: deps.limiter ?? usdaHourlyLimiter,
  };
}

function nutrientId(n: UsdaNutrient): number | undefined {
  return n.nutrient?.id ?? n.nutrientId;
}

function nutrientAmount(n: UsdaNutrient): number | undefined {
  const value = n.amount ?? n.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function nutrientUnit(n: UsdaNutrient): string {
  return (n.nutrient?.unitName ?? n.unitName ?? '').toLowerCase();
}

function pickAmount(nutrients: UsdaNutrient[], ids: number[]): { amount: number; unit: string } | null {
  for (const id of ids) {
    const hit = nutrients.find((n) => nutrientId(n) === id);
    const amount = hit ? nutrientAmount(hit) : undefined;
    if (hit && amount !== undefined) {
      return { amount, unit: nutrientUnit(hit) };
    }
  }
  return null;
}

function toKcal(nutrients: UsdaNutrient[]): number | null {
  const kcal = pickAmount(nutrients, ENERGY_KCAL_IDS);
  if (kcal) {
    if (kcal.unit === 'kj') return kjToKcal(kcal.amount);
    return kcal.amount;
  }
  const kj = pickAmount(nutrients, [ENERGY_KJ_ID]);
  if (kj) {
    if (kj.unit === 'kcal') return kj.amount;
    return kjToKcal(kj.amount);
  }
  return null;
}

function toGramsAmount(nutrients: UsdaNutrient[], ids: number[]): number {
  const hit = pickAmount(nutrients, ids);
  if (!hit) return 0;
  if (hit.unit === 'mg') return hit.amount / 1000;
  return hit.amount;
}

function toMgAmount(nutrients: UsdaNutrient[], ids: number[]): number {
  const hit = pickAmount(nutrients, ids);
  if (!hit) return 0;
  if (hit.unit === 'g') return hit.amount * 1000;
  return hit.amount;
}

function extractPer100g(nutrients: UsdaNutrient[]): NutrientsPer100g | null {
  const kcal = toKcal(nutrients);
  if (kcal === null) return null;
  if ([PROTEIN_ID, CARB_ID, FAT_ID].some((id) => !pickAmount(nutrients, [id]))) return null;
  return {
    kcal,
    protein_g: toGramsAmount(nutrients, [PROTEIN_ID]),
    carbs_g: toGramsAmount(nutrients, [CARB_ID]),
    fat_g: toGramsAmount(nutrients, [FAT_ID]),
    fiber_g: toGramsAmount(nutrients, [FIBER_ID]),
    sugar_g: toGramsAmount(nutrients, SUGAR_IDS),
    sodium_mg: toMgAmount(nutrients, [SODIUM_ID]),
  };
}

function brandedServingGrams(food: UsdaFoodPayload): number | null {
  if (typeof food.servingSize !== 'number' || food.servingSize <= 0) return null;
  return toGrams(food.servingSize, food.servingSizeUnit ?? 'g');
}

function portionLabel(portion: UsdaPortion): string {
  const described = portion.portionDescription?.trim();
  if (described) return described;
  const amount = portion.amount;
  const modifier = portion.modifier?.trim();
  const unit = portion.measureUnit?.name?.trim();
  const unitLabel = unit && unit.toLowerCase() !== 'undetermined' ? unit : modifier;
  if (amount && unitLabel) return `${amount} ${unitLabel}`;
  if (modifier) return modifier;
  if (typeof portion.gramWeight === 'number') return `${portion.gramWeight} g`;
  return 'serving';
}

function servingsFor(food: UsdaFoodPayload): FoodServing[] {
  const servings: FoodServing[] = [];
  const household = food.householdServingFullText?.trim();
  const brandedGrams = brandedServingGrams(food);
  if (household && brandedGrams) {
    servings.push({ label: displayName(household), grams: brandedGrams, isDefault: true });
  }
  for (const portion of food.foodPortions ?? []) {
    if (typeof portion.gramWeight !== 'number' || portion.gramWeight <= 0) continue;
    servings.push({ label: portionLabel(portion), grams: portion.gramWeight });
  }
  return withDefaultServings(servings);
}

function usdaConfidence(dataType: string | undefined): number {
  if (!dataType) return 0.65;
  return DATA_TYPE_CONFIDENCE[dataType] ?? 0.65;
}

export function mapUsdaFood(food: UsdaFoodPayload): NormalizedFood | null {
  if (typeof food.fdcId !== 'number' || !food.description?.trim()) return null;
  const nutrients = extractPer100g(food.foodNutrients ?? []);
  if (!nutrients) return null;

  const dataType = food.dataType ?? '';
  // FDC foodNutrients are already standardized per 100 g, including branded
  // foods. Only labelNutrients use label portions; do not divide a second time.
  const per100g = nutrients;

  const brand = food.brandName?.trim() || food.brandOwner?.trim() || undefined;
  const barcode = normalizeBarcode(food.gtinUpc ?? undefined);

  return {
    name: displayName(food.description),
    ...(brand ? { brand: displayName(brand) } : {}),
    ...(barcode ? { barcode } : {}),
    per100g,
    servings: servingsFor(food),
    source: 'usda_fdc',
    sourceId: String(food.fdcId),
    confidence: usdaConfidence(dataType),
    sourceNote: USDA_SOURCE_NOTE,
  };
}

function rankUsda(food: UsdaFoodPayload): number {
  return DATA_TYPE_RANK[food.dataType ?? ''] ?? 50;
}

export async function searchUsda(query: string, deps: UsdaDeps = {}): Promise<NormalizedFood[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const apiKey = requireApiKey(deps);
  const url = `${SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}`;
  const result = await requestJson<UsdaSearchPayload>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: trimmed,
        pageSize: 25,
        dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
      }),
    },
    httpDeps(deps),
  );
  if (!result.ok) {
    throw new FoodSourceError('USDA search failed', result.status);
  }
  const mapped = (result.data.foods ?? [])
    .slice()
    .sort((a, b) => rankUsda(a) - rankUsda(b))
    .map(mapUsdaFood)
    .filter((food): food is NormalizedFood => food !== null);
  return mapped;
}

export async function getUsdaFood(
  fdcId: number | string,
  deps: UsdaDeps = {},
): Promise<NormalizedFood | null> {
  const id = String(fdcId).trim();
  if (!id) return null;
  const apiKey = requireApiKey(deps);
  const url = `${FOOD_URL}/${encodeURIComponent(id)}?api_key=${encodeURIComponent(apiKey)}`;
  const result = await requestJson<UsdaFoodPayload>(
    url,
    { headers: { Accept: 'application/json' } },
    httpDeps(deps),
  );
  if (!result.ok) {
    if (result.status === 404) return null;
    throw new FoodSourceError('USDA food lookup failed', result.status);
  }
  return mapUsdaFood(result.data);
}
