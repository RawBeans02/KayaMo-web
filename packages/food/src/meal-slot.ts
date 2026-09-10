export const MEAL_SLOTS = ['almusal', 'tanghalian', 'meryenda', 'hapunan'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Mirrors the `profiles.locale` check constraint in @kayamo/db. */
export const LOCALES = ['en', 'fil', 'taglish'] as const;
export type Locale = (typeof LOCALES)[number];

// Shared product default; desktop chooses its own English UI default.
export const DEFAULT_LOCALE: Locale = 'taglish';

/**
 * Taglish keeps the Filipino meal names because that is what people say even
 * when the rest of the sentence is English.
 */
const LABELS: Record<Locale, Record<MealSlot, string>> = {
  en: {
    almusal: 'Breakfast',
    tanghalian: 'Lunch',
    meryenda: 'Snack',
    hapunan: 'Dinner',
  },
  fil: {
    almusal: 'Almusal',
    tanghalian: 'Tanghalian',
    meryenda: 'Meryenda',
    hapunan: 'Hapunan',
  },
  taglish: {
    almusal: 'Almusal',
    tanghalian: 'Tanghalian',
    meryenda: 'Meryenda',
    hapunan: 'Hapunan',
  },
};

/** Local clock hour 0–23 in the user's timezone. Independent of day_starts_at. */
export function mealSlotAtHour(hour: number): MealSlot {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 11) return 'almusal';
  if (h >= 11 && h < 15) return 'tanghalian';
  if (h >= 15 && h < 18) return 'meryenda';
  return 'hapunan';
}

export function mealSlotLabel(slot: MealSlot, locale: Locale = DEFAULT_LOCALE): string {
  return LABELS[locale][slot];
}

export function isMealSlot(value: string): value is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value);
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Narrows a `profiles.locale` column value, which the row type types as text. */
export function asLocale(value: string | null | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

export function asMealSlot(value: string | null | undefined): MealSlot | null {
  return value && isMealSlot(value) ? value : null;
}

/** Meal order for grouped day views. Snacks sit between lunch and dinner. */
export function orderedMealSlots(): MealSlot[] {
  return ['almusal', 'tanghalian', 'meryenda', 'hapunan'];
}

export function shiftLogicalDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
