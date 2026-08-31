import type { CatalogExercise } from './kb/types';

export function familyOverlapWarnings(
  items: Array<{ slug: string; familyId?: string; exerciseName: string }>,
  catalog: readonly CatalogExercise[],
): string[] {
  const byFamily = new Map<string, string[]>();
  for (const item of items) {
    const family =
      item.familyId ?? catalog.find((row) => row.slug === item.slug)?.familyId ?? item.slug;
    const names = byFamily.get(family) ?? [];
    names.push(item.exerciseName);
    byFamily.set(family, names);
  }
  return [...byFamily.values()]
    .filter((names) => names.length > 1)
    .map((names) => `${names.join(' + ')} may overlap. Keep both if that is intentional.`);
}
