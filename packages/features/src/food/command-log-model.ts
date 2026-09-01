import type { LogFoodEntryInput } from '@kayamo/offline';
import {
  nutrientsFromPer100g,
  persistableFoodId,
  toConfidenceString,
  type CatalogFood,
  type FoodCandidate,
} from '@kayamo/food/search-ui';
import { MEAL_SLOTS, type MealSlot } from '@kayamo/food/quick-log';

const COMMAND_LOG_SOURCES = new Set<CatalogFood['source']>(['ph_core', 'user']);

/** Cmd+K stays on persistable local catalog. USDA/OFF need a service-role resolve path we do not have. */
export function catalogForCommandLog(foods: readonly CatalogFood[]): CatalogFood[] {
  return foods.filter((food) => COMMAND_LOG_SOURCES.has(food.source));
}

export const PREFILL_LOG_EVENT = 'kayamo:prefill-log';
export const OPEN_LOG_EVENT = 'kayamo:open-log';

export function asLogSource(value: string): LogFoodEntryInput['source'] {
  if (
    value === 'ph_core' ||
    value === 'usda_fdc' ||
    value === 'off' ||
    value === 'user' ||
    value === 'llm'
  ) {
    return value;
  }
  return 'user';
}

export function asResolvedVia(value: string): LogFoodEntryInput['resolvedVia'] {
  if (
    value === 'ph_core' ||
    value === 'usda_fdc' ||
    value === 'off' ||
    value === 'user' ||
    value === 'llm' ||
    value === 'recipe'
  ) {
    return value;
  }
  return 'user';
}

export function cycleMealSlot(current: MealSlot, direction: 1 | -1): MealSlot {
  const index = MEAL_SLOTS.indexOf(current);
  const next = (index + direction + MEAL_SLOTS.length) % MEAL_SLOTS.length;
  return MEAL_SLOTS[next] ?? current;
}

export function mealSlotFromDigit(key: string): MealSlot | null {
  if (key === '1') return 'almusal';
  if (key === '2') return 'tanghalian';
  if (key === '3') return 'meryenda';
  if (key === '4') return 'hapunan';
  return null;
}

export function servingIdForLabel(
  servings: ReadonlyArray<{ id: string; label: string; is_default: boolean }>,
  label: string | null,
): string | null {
  if (label) {
    const named = servings.find((row) => row.label === label);
    if (named) return named.id;
  }
  return servings.find((row) => row.is_default)?.id ?? servings[0]?.id ?? null;
}

export function quantityFromCandidate(
  candidate: FoodCandidate,
  quantityOverride?: number,
): { quantity: string; grams: string; servingLabel: string } {
  const amount = quantityOverride ?? candidate.portion.amount ?? 1;
  const gramsEach =
    candidate.portion.amount > 0
      ? candidate.portion.grams / candidate.portion.amount
      : candidate.portion.grams;
  const grams = gramsEach * amount;
  const servingLabel =
    amount === 1
      ? candidate.portion.servingLabel
      : `${amount} × ${candidate.portion.servingLabel}`;
  return {
    quantity: String(amount),
    grams: String(grams),
    servingLabel,
  };
}

export function toLogInputFromCandidate(params: {
  userId: string;
  mealSlot: MealSlot;
  candidate: FoodCandidate;
  servingId: string | null;
  timeZone: string;
  dayStartsAt: string;
  quantityOverride?: number;
}): LogFoodEntryInput | null {
  const foodId = persistableFoodId(params.candidate.foodId);
  if (!foodId) return null;
  const qty = quantityFromCandidate(params.candidate, params.quantityOverride);
  const nutrients = nutrientsFromPer100g(
    params.candidate.per100g,
    Number(qty.grams),
  );
  return {
    userId: params.userId,
    mealSlot: params.mealSlot,
    foodId,
    foodName: params.candidate.name,
    quantity: qty.quantity,
    grams: qty.grams,
    ...nutrients,
    source: asLogSource(params.candidate.source),
    resolvedVia: asResolvedVia(params.candidate.source),
    inputMethod: 'search',
    servingId: params.servingId,
    servingLabel: qty.servingLabel,
    confidence: toConfidenceString(params.candidate.confidence),
    timeZone: params.timeZone,
    dayStartsAt: params.dayStartsAt,
  };
}

export function clampSelectedIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}
