import type { LogFoodEntryInput } from '@kayamo/offline';
import {
  nutrientsFromPer100g,
  persistableFoodId,
  toConfidenceString,
  type CatalogFood,
  type FoodCandidate,
} from '@kayamo/food/search-ui';
import { MEAL_SLOTS, type MealSlot } from '@kayamo/food/quick-log';

const COMMAND_LOG_SOURCES = new Set<CatalogFood['source']>(['ph_core', 'user', 'usda_fdc', 'off']);

/** Quick entry includes every sourced food already present in the local catalog. */
export function catalogForCommandLog(foods: readonly CatalogFood[]): CatalogFood[] {
  return foods.filter((food) => COMMAND_LOG_SOURCES.has(food.source));
}

export const PREFILL_LOG_EVENT = 'kayamo:prefill-log';
export const OPEN_LOG_EVENT = 'kayamo:open-log';

export function openLogPalette(mealSlot?: MealSlot): void {
  window.dispatchEvent(
    new CustomEvent(OPEN_LOG_EVENT, { detail: mealSlot ? { mealSlot } : {} }),
  );
}

type PrefillLogDetail = { query: string };

/**
 * The only way to ask the palette to open with text. Two dispatchers built the
 * event by hand and disagreed on the payload: one sent `{ query }`, the shell
 * sent the bare string, and the listener read `detail.query`, so the log
 * sheet's "Meal → Find this food" silently did nothing. Build it here, read it
 * with readPrefillLogEvent, and the shape cannot drift again.
 */
export function prefillLogPalette(query: string, target: EventTarget = window): void {
  const detail: PrefillLogDetail = { query };
  target.dispatchEvent(new CustomEvent<PrefillLogDetail>(PREFILL_LOG_EVENT, { detail }));
}

/** The trimmed query, or null when the event carries none. A string detail is null. */
export function readPrefillLogEvent(event: Event): string | null {
  const detail: unknown = (event as CustomEvent<unknown>).detail;
  if (!detail || typeof detail !== 'object') return null;
  const query = (detail as { query?: unknown }).query;
  if (typeof query !== 'string') return null;
  const trimmed = query.trim();
  return trimmed ? trimmed : null;
}

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
    // The food keeps its catalog identity; who resolved the numbers is separate.
    // A row edited in this browser's Verify overlay was resolved by the person.
    resolvedVia: params.candidate.locallyEdited ? 'user' : asResolvedVia(params.candidate.source),
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
    .filter((food) => COMMAND_LOG_SOURCES.has(food.source))
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
  return 'Stays open · a plate is several items';
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
    ...(food.locallyEdited ? { locallyEdited: true } : {}),
  };
}

export const PALETTE_LEAVE_ACTIONS = [
  {
    href: '/foods',
    title: 'Create a custom food',
    sub: 'Name, macros per 100 g, a serving, a source note',
    key: '⌘N',
  },
  {
    href: '/foods',
    title: 'Search worldwide foods',
    sub: 'Open international ingredient and packaged-food search',
    key: '⌘⇧F',
  },
  {
    href: '/mus',
    title: 'Ask Lis what this is',
    sub: 'Lis proposes a row. You confirm before it saves.',
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
  if (key === 'n' && !event.shiftKey) return '/foods';
  if (key === 'f' && event.shiftKey) return '/foods';
  if (key === 'm' && !event.shiftKey) return '/mus';
  return null;
}
