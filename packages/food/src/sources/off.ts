import { OFF_ATTRIBUTION } from '../licenses';
import {
  displayName,
  firstBrand,
  kjToKcal,
  normalizeBarcode,
  parseGramsFromText,
  withDefaultServings,
} from '../normalize';
import { FoodSourceError, type FoodServing, type NormalizedFood, type NutrientsPer100g } from '../types';
import type { SourceHttpDeps } from './http';
import { requestJson } from './http';
import { offHourlyLimiter } from './limiter';

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const DEFAULT_USER_AGENT = 'KayaMo/1.0 (contact@kayamo.ph)';

export type OffDeps = SourceHttpDeps & {
  userAgent?: string;
};

type OffNutriments = Record<string, number | string | undefined>;

type OffProductPayload = {
  product_name?: string | null;
  product_name_en?: string | null;
  generic_name?: string | null;
  brands?: string | null;
  code?: string | null;
  serving_size?: string | number | null;
  serving_quantity?: number | string | null;
  nutriments?: OffNutriments;
};

type OffProductResponse = {
  status?: number;
  code?: string;
  product?: OffProductPayload;
};

type OffSearchResponse = {
  products?: OffProductPayload[];
};

function userAgent(deps: OffDeps): string {
  return deps.userAgent ?? process.env.OFF_USER_AGENT?.trim() ?? DEFAULT_USER_AGENT;
}

function httpDeps(deps: OffDeps): SourceHttpDeps {
  return {
    fetch: deps.fetch,
    limiter: deps.limiter ?? offHourlyLimiter,
  };
}

function headers(deps: OffDeps): HeadersInit {
  return {
    Accept: 'application/json',
    'User-Agent': userAgent(deps),
  };
}

function numberField(nutriments: OffNutriments, keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = nutriments[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function per100gFromNutriments(nutriments: OffNutriments): NutrientsPer100g | null {
  const kcalDirect = numberField(nutriments, ['energy-kcal_100g']);
  const energyKj = numberField(nutriments, ['energy_100g']);
  const kcal = kcalDirect ?? (energyKj !== undefined ? kjToKcal(energyKj) : undefined);
  if (kcal === undefined) return null;
  const protein = numberField(nutriments, ['proteins_100g']);
  const carbs = numberField(nutriments, ['carbohydrates_100g']);
  const fat = numberField(nutriments, ['fat_100g']);
  if (protein === undefined || carbs === undefined || fat === undefined) return null;

  const sodiumG = numberField(nutriments, ['sodium_100g']);
  const saltG = numberField(nutriments, ['salt_100g']);
  const sodiumMg =
    sodiumG !== undefined ? sodiumG * 1000 : saltG !== undefined ? (saltG / 2.5) * 1000 : 0;

  return {
    kcal,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: numberField(nutriments, ['fiber_100g', 'fibre_100g']) ?? 0,
    sugar_g: numberField(nutriments, ['sugars_100g']) ?? 0,
    sodium_mg: sodiumMg,
  };
}

function servingQuantityGrams(product: OffProductPayload): number | null {
  if (typeof product.serving_quantity === 'number' && product.serving_quantity > 0) {
    return product.serving_quantity;
  }
  if (typeof product.serving_quantity === 'string') {
    const parsed = Number(product.serving_quantity);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (typeof product.serving_size === 'string') {
    return parseGramsFromText(product.serving_size);
  }
  return null;
}

function offServings(product: OffProductPayload): FoodServing[] {
  const servings: FoodServing[] = [];
  const grams = servingQuantityGrams(product);
  if (grams) {
    const label =
      typeof product.serving_size === 'string' && product.serving_size.trim()
        ? product.serving_size.trim()
        : `${grams} g`;
    servings.push({ label, grams, isDefault: true });
  }
  return withDefaultServings(servings);
}

function offConfidence(per100g: NutrientsPer100g): number {
  const complete = per100g.protein_g > 0 || per100g.carbs_g > 0 || per100g.fat_g > 0;
  return complete ? 0.8 : 0.6;
}

export function mapOffProduct(
  product: OffProductPayload,
  fallbackCode?: string,
): NormalizedFood | null {
  const name = (product.product_name || product.product_name_en || product.generic_name || '').trim();
  if (!name) return null;
  const nutriments = product.nutriments ?? {};
  const per100g = per100gFromNutriments(nutriments);
  if (!per100g) return null;
  const barcode = normalizeBarcode(product.code ?? fallbackCode);
  const brand = firstBrand(product.brands ?? undefined);

  return {
    name: displayName(name),
    ...(brand ? { brand } : {}),
    ...(barcode ? { barcode } : {}),
    per100g,
    servings: offServings(product),
    source: 'off',
    sourceId: barcode ?? product.code ?? name,
    confidence: offConfidence(per100g),
    attribution: OFF_ATTRIBUTION,
  };
}

export async function lookupOffBarcode(
  barcode: string,
  deps: OffDeps = {},
): Promise<NormalizedFood | null> {
  const code = normalizeBarcode(barcode);
  if (!code) return null;
  const url = `${PRODUCT_URL}/${encodeURIComponent(code)}.json`;
  const result = await requestJson<OffProductResponse>(
    url,
    { headers: headers(deps) },
    httpDeps(deps),
  );
  if (!result.ok) {
    if (result.status === 404) return null;
    throw new FoodSourceError('Open Food Facts barcode lookup failed', result.status);
  }
  if (result.data.status !== 1 || !result.data.product) return null;
  return mapOffProduct(result.data.product, result.data.code ?? code);
}

export async function searchOff(query: string, deps: OffDeps = {}): Promise<NormalizedFood[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const params = new URLSearchParams({
    search_terms: trimmed,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
  });
  const url = `${SEARCH_URL}?${params.toString()}`;
  const result = await requestJson<OffSearchResponse>(
    url,
    { headers: headers(deps) },
    httpDeps(deps),
  );
  if (!result.ok) {
    throw new FoodSourceError('Open Food Facts search failed', result.status);
  }
  return (result.data.products ?? [])
    .map((product) => mapOffProduct(product))
    .filter((food): food is NormalizedFood => food !== null);
}
