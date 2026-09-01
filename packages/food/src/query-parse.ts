import { looksLikeBarcode, normalizeBarcode, normalizeName } from './normalize';

export const PH_UNITS = ['tasa', 'piraso', 'order', 'hiwa', 'kutsara', 'bowl'] as const;
export const SIZE_WORDS = ['malaki', 'sakto', 'maliit'] as const;
export const SIZE_MULTIPLIER: Record<(typeof SIZE_WORDS)[number], number> = {
  malaki: 1.3,
  sakto: 1,
  maliit: 0.7,
};

const PARSE_UNITS = [
  'kutsara',
  'piraso',
  'tasa',
  'order',
  'hiwa',
  'bowl',
  'tablespoons',
  'tablespoon',
  'tbsp',
  'teaspoons',
  'teaspoon',
  'tsp',
  'slices',
  'slice',
  'pieces',
  'piece',
  'pcs',
  'pc',
  'servings',
  'serving',
  'scoops',
  'scoop',
  'glasses',
  'glass',
  'bottles',
  'bottle',
  'packs',
  'pack',
  'cans',
  'can',
  'cups',
  'cup',
  'kilograms',
  'kilogram',
  'grams',
  'gram',
  'fl oz',
  'floz',
  'kg',
  'oz',
  'ml',
  'l',
  'g',
] as const;

const UNIT_PATTERN = [...PARSE_UNITS].sort((a, b) => b.length - a.length).join('|');
const SIZE_PATTERN = SIZE_WORDS.join('|');
const AMOUNT_PATTERN = String.raw`\d+\/\d+|\d+(?:\.\d+)?|½|¼|¾|1⁄2|one|two|three|four|five|six|seven|eight|nine|ten|half|a|an`;

const WORD_AMOUNTS: Record<string, number> = {
  '½': 0.5,
  '1⁄2': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  half: 0.5,
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

export type ParsedFoodQuery = {
  raw: string;
  barcode?: string;
  name: string;
  amount: number;
  unit?: string;
  size?: (typeof SIZE_WORDS)[number];
};

export type FoodQuery = {
  text?: string;
  barcode?: string;
};

export function parseAmountToken(raw: string | undefined): number | null {
  if (!raw) return null;
  const token = raw.trim().toLowerCase();
  if (WORD_AMOUNTS[token] !== undefined) return WORD_AMOUNTS[token];
  if (/^\d+\/\d+$/.test(token)) {
    const [numerator, denominator] = token.split('/').map(Number);
    if (!numerator || !denominator) return null;
    const value = numerator / denominator;
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const value = Number(token);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseFoodQuery(query: FoodQuery): ParsedFoodQuery {
  const barcode = normalizeBarcode(query.barcode) ?? (query.text ? normalizeBarcode(query.text) : undefined);
  if (barcode && looksLikeBarcode(barcode)) {
    return {
      raw: query.text?.trim() || barcode,
      barcode,
      name: '',
      amount: 1,
    };
  }

  const raw = (query.text ?? '').trim();
  if (!raw) {
    return { raw: '', name: '', amount: 1 };
  }

  const stuck = raw.match(new RegExp(`^(${AMOUNT_PATTERN})\\s*(${UNIT_PATTERN})\\s+(.+)$`, 'i'));
  if (stuck) {
    return fromParts(raw, stuck[1], undefined, stuck[2], stuck[3]);
  }

  const spaced = raw.match(
    new RegExp(
      `^(?:(${AMOUNT_PATTERN})\\s+)?(?:(${SIZE_PATTERN})\\s+)?(?:(${UNIT_PATTERN})\\s+)?(.+)$`,
      'i',
    ),
  );
  if (!spaced) {
    return { raw, name: normalizeName(raw), amount: 1 };
  }

  return fromParts(raw, spaced[1], spaced[2], spaced[3], spaced[4]);
}

function fromParts(
  raw: string,
  amountRaw: string | undefined,
  sizeRaw: string | undefined,
  unitRaw: string | undefined,
  nameRaw: string | undefined,
): ParsedFoodQuery {
  const amount = parseAmountToken(amountRaw) ?? 1;
  const sizeKey = sizeRaw?.toLowerCase();
  const unit = unitRaw?.toLowerCase();
  const name = (nameRaw ?? raw).trim().replace(/^(ng|na|of|ang)\s+/i, '');
  const size = SIZE_WORDS.find((word) => word === sizeKey);
  return {
    raw,
    name: normalizeName(name),
    amount,
    ...(unit ? { unit } : {}),
    ...(size ? { size } : {}),
  };
}
