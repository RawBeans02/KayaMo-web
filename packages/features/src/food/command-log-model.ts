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

/** Design debounce for the desk palette skeleton. Search UI elsewhere stays at 280ms. */
export const PALETTE_DEBOUNCE_MS = 260;

export type PaletteView = 'ready' | 'searching' | 'results' | 'none';

export function paletteView(query: string, searching: boolean, resultCount: number): PaletteView {
  if (!query.trim()) return 'ready';
  if (searching) return 'searching';
  return resultCount > 0 ? 'results' : 'none';
}

export type PlateItem = {
  id: string;
  label: string;
  kcal: number;
};

export function plateTotalKcal(items: readonly PlateItem[]): number {
  return items.reduce((sum, item) => sum + item.kcal, 0);
}

export function readyCatalogFoods(
  catalog: readonly CatalogFood[],
  logCounts: ReadonlyMap<string, number>,
  limit = 4,
): CatalogFood[] {
  return catalog
    .filter((food) => food.source === 'ph_core' || food.source === 'user')
    .slice()
    .sort((a, b) => {
      const byCount = (logCounts.get(b.id) ?? 0) - (logCounts.get(a.id) ?? 0);
      if (byCount !== 0) return byCount;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function aliasLine(food: Pick<CatalogFood, 'nameTl' | 'aliases'>): string {
  return [...food.nameTl, ...food.aliases].filter(Boolean).slice(0, 3).join(' · ');
}

export function loggedStatus(slotLabel: string): string {
  return `Logged · ${slotLabel} · palette stays open`;
}

export function idlePaletteStatus(plateCount: number): string {
  if (plateCount > 0) return `${plateCount} logged · keep going`;
  return 'Stays open — a plate is several items';
}

export function paletteStateLabel(view: PaletteView, resultCount: number): string {
  if (view === 'ready') return 'ready';
  if (view === 'searching') return 'searching';
  if (view === 'results') return resultCount === 1 ? '1 match' : `${resultCount} matches`;
  return 'no match';
}

export function frequencyLabel(timesLogged: number): string {
  return timesLogged > 0 ? `${timesLogged}×` : '';
}

export function servingCaption(portion: { servingLabel: string; grams: number }): string {
  return `${portion.servingLabel} · ${Math.round(portion.grams)} g`;
}

export function previewQtyKcal(
  kcalPerServing: number,
  servingAmount: number,
  qtyRaw: string,
): number {
  const qty = Number(qtyRaw);
  const amount = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const per = servingAmount > 0 ? kcalPerServing / servingAmount : kcalPerServing;
  return Math.round(per * amount);
}

export function candidateFromCatalogFood(
  food: CatalogFood,
  timesLogged: number,
): FoodCandidate {
  const serving = food.servings.find((row) => row.isDefault) ?? food.servings[0];
  const grams = serving?.grams ?? 100;
  const servingLabel = serving?.label ?? '100 g';
  return {
    foodId: food.id,
    name: food.name,
    source: food.source,
    ...(food.sourceId ? { sourceId: food.sourceId } : {}),
    confidence: food.confidence,
    rankScore: timesLogged,
    matchScore: 1,
    timesLogged,
    whyMatched: 'ready',
    per100g: food.per100g,
    servings: food.servings,
    portion: {
      amount: 1,
      unit: servingLabel,
      grams,
      servingLabel,
      kcal: (food.per100g.kcal * grams) / 100,
    },
    ...(food.verified ? { verified: true } : {}),
  };
}

export const PALETTE_LEAVE_ACTIONS = [
  {
    href: '/verify',
    title: 'Create it in PH core',
    sub: 'Name, macros per 100 g, a serving, a source note',
    key: '⌘N',
  },
  {
    href: '/foods',
    title: 'Search brands and USDA',
    sub: 'Leaves the palette and opens Foods, filtered',
    key: '⌘⇧F',
  },
  {
    href: '/mus',
    title: 'Ask Mus what this is',
    sub: 'Mus proposes a row. You confirm before it saves.',
    key: '⌘M',
  },
] as const;

export const PALETTE_KEYS = [
  { key: '↑↓', label: 'move' },
  { key: 'Enter', label: 'log' },
  { key: 'Tab', label: 'quantity' },
  { key: '⌥1–4', label: 'meal' },
  { key: 'Esc', label: 'close' },
] as const;

export const PALETTE_SKELETONS = [
  { w1: '46%', w2: '30%' },
  { w1: '38%', w2: '25%' },
  { w1: '52%', w2: '34%' },
  { w1: '33%', w2: '22%' },
] as const;

/** No-match shortcuts leave the palette. They are navigation, not writes. */
export function leaveHrefFromPaletteKey(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  key: string;
}): string | null {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return null;
  const key = event.key.toLowerCase();
  if (key === 'n' && !event.shiftKey) return '/verify';
  if (key === 'f' && event.shiftKey) return '/foods';
  if (key === 'm' && !event.shiftKey) return '/mus';
  return null;
}
