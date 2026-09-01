import type { Food } from '@kayamo/db';
import type { ResolveSource } from '@kayamo/food';

export const CATALOG_SOURCES = ['ph_core', 'off', 'usda_fdc', 'user', 'llm'] as const;
export type CatalogSource = (typeof CATALOG_SOURCES)[number];

export type CatalogSourceFilter = 'all' | CatalogSource;

export const SOURCE_SHAPE: ReadonlyArray<{
  source: CatalogSource;
  label: string;
  sub: string;
  token: string;
}> = [
  { source: 'ph_core', label: 'PH core', sub: 'hand-built', token: 'var(--color-accent)' },
  { source: 'off', label: 'Brand', sub: 'barcode scans', token: 'var(--color-proposal)' },
  { source: 'usda_fdc', label: 'USDA', sub: 'imported', token: 'var(--color-source-usda)' },
  { source: 'user', label: 'Yours', sub: 'created here', token: 'var(--color-source-user)' },
  { source: 'llm', label: 'Photo', sub: 'range only', token: 'var(--color-warning)' },
];

export type CatalogShapeSlice = {
  source: CatalogSource;
  label: string;
  sub: string;
  token: string;
  count: number;
  width: string;
};

export type PhotoRange = { low: number; high: number };

export function isCatalogSource(value: string): value is CatalogSource {
  return (CATALOG_SOURCES as readonly string[]).includes(value as CatalogSource);
}

export function catalogBadge(source: string): string {
  if (source === 'ph_core') return 'PH';
  if (source === 'off') return 'Brand';
  if (source === 'usda_fdc') return 'USDA';
  if (source === 'user') return 'Yours';
  if (source === 'llm') return 'Photo';
  return source;
}

export function provenanceLabel(source: string, verified: boolean): string {
  if (source === 'llm') return 'range only';
  if (verified) return 'verified';
  if (source === 'ph_core') return 'estimated';
  if (source === 'user') return 'yours';
  return 'imported';
}

export function photoKcalRange(attribution: string | null | undefined): PhotoRange | null {
  if (!attribution) return null;
  try {
    const parsed = JSON.parse(attribution) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed as { kcal_low?: unknown; kcal_high?: unknown };
    const low = Number(row.kcal_low);
    const high = Number(row.kcal_high);
    if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) return null;
    return { low, high };
  } catch {
    return null;
  }
}

export function kcalCell(food: Pick<Food, 'kcal' | 'source' | 'attribution'>): string {
  if (food.source === 'llm') {
    const range = photoKcalRange(food.attribution);
    if (range) return `${Math.round(range.low)}–${Math.round(range.high)}`;
    return '—';
  }
  const n = Number(food.kcal);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-PH') : '—';
}

export function catalogHaystack(
  food: { name: string; name_tl?: readonly string[] | null },
  extraAliases: readonly string[] = [],
): string {
  return [food.name, ...(food.name_tl ?? []), ...extraAliases].join(' ').toLowerCase();
}

export function filterCatalog<T extends Pick<Food, 'name' | 'name_tl' | 'source'>>(
  rows: readonly T[],
  query: string,
  source: CatalogSourceFilter,
  aliases: ReadonlyMap<string, string[]> = new Map(),
): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((food) => {
    if (source !== 'all' && food.source !== source) return false;
    if (!q) return true;
    const id = 'id' in food && typeof food.id === 'string' ? food.id : '';
    return catalogHaystack(food, aliases.get(id) ?? []).includes(q);
  });
}

export function catalogShape(rows: readonly Pick<Food, 'source'>[]): CatalogShapeSlice[] {
  const counts: Record<CatalogSource, number> = {
    ph_core: 0,
    off: 0,
    usda_fdc: 0,
    user: 0,
    llm: 0,
  };
  for (const row of rows) {
    if (isCatalogSource(row.source)) counts[row.source] += 1;
  }
  const total = Math.max(rows.length, 1);
  return SOURCE_SHAPE.map((item) => ({
    ...item,
    count: counts[item.source],
    width: `${(counts[item.source] / total) * 100}%`,
  }));
}

export function foodsCountLabel(visible: number, total: number): string {
  if (visible === total) return `${total} foods`;
  return `${visible} of ${total}`;
}

export function indexMatchingQuery<T extends { name: string; name_tl?: string[] | null }>(
  rows: readonly T[],
  query: string,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return -1;
  return rows.findIndex((row) => catalogHaystack(row).includes(q));
}

export function uniqueAliases(...lists: Array<readonly string[] | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const alias of list ?? []) {
      const trimmed = alias.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

export function asFoodSource(source: string): ResolveSource {
  if (source === 'ph_core' || source === 'off' || source === 'usda_fdc' || source === 'user' || source === 'llm') {
    return source;
  }
  return 'user';
}
