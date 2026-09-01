import { normalizeName } from './normalize';

export const DEFAULT_FOOD_ALIASES: Record<string, string> = {
  hifun: 'Hy Fun Hash Brown',
  'hi fun': 'Hy Fun Hash Brown',
  'hy fun': 'Hy Fun Hash Brown',
  marbys: "Marby's Wheat Bread",
  "marby's": "Marby's Wheat Bread",
  'marbys wheat': "Marby's Wheat Bread",
  skippy: 'Skippy Peanut Butter',
  nutella: 'Nutella',
  flattops: 'Ricoa Flat Tops',
  'flat tops': 'Ricoa Flat Tops',
  athlene: 'Athlene Active Vegan Protein',
  'athlene vegan': 'Athlene Active Vegan Protein',
};

export function normalizeAlias(value: string): string {
  return normalizeName(value).replace(/['’]/g, '');
}

export function lookupAlias(
  query: string,
  extra: Readonly<Record<string, string>> = {},
): string {
  const normalized = normalizeAlias(query);
  const table = { ...DEFAULT_FOOD_ALIASES, ...extra };
  const direct = table[normalized];
  if (direct) return direct;
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalized === key || normalized.startsWith(`${key} `) || normalized.endsWith(` ${key}`)) {
      return table[key] ?? query;
    }
  }
  return query;
}

export function applyAliases(query: string, extra: Readonly<Record<string, string>> = {}): string {
  const resolved = lookupAlias(query, extra);
  if (resolved !== query) return resolved;
  const words = query.trim().split(/\s+/);
  if (words[0]) {
    const first = lookupAlias(words[0], extra);
    if (first !== words[0]) return [first, ...words.slice(1)].join(' ');
  }
  return query;
}
