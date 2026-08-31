import { buildGymKnowledgeBase, catalogForAi, substitutesFor } from './kb/assemble';
import type { Mechanic, SplitGroup } from './kb/enums';
import type { CatalogExercise } from './kb/types';

export type MovementKind = Mechanic;
export type MovementPattern = string;
export type { CatalogExercise, SplitGroup };
export { SPLIT_GROUPS } from './kb/enums';

export const gymKb = buildGymKnowledgeBase();
export const GYM_CATALOG: readonly CatalogExercise[] = gymKb.exercises;

function matchesGear(row: CatalogExercise, chip: string): boolean {
  const ids = row.requiredEquipment;
  if (ids.includes(chip) || row.equipment === chip) return true;
  if (chip === 'barbell') {
    return ids.some((id) => id.includes('barbell') || id === 'trap_bar' || id === 'ez_curl_bar' || id === 'safety_squat_bar');
  }
  if (chip === 'dumbbell') return ids.some((id) => id.includes('dumbbell'));
  if (chip === 'cable') return ids.some((id) => id.includes('cable') || id === 'functional_trainer');
  if (chip === 'machine') {
    return ids.some(
      (id) =>
        id.includes('machine') ||
        id === 'leg_press' ||
        id === 'pec_deck' ||
        id === 'ghd',
    );
  }
  if (chip === 'bodyweight') return ids.includes('bodyweight');
  return false;
}

/** Stable local id so the same catalog lift groups sets across sessions. */
export function catalogExerciseId(slug: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `a1b2c3d4-e5f6-7890-abcd-${hex}${hex.slice(0, 4)}`;
}

export function exerciseBySlug(slug: string): CatalogExercise | undefined {
  return GYM_CATALOG.find((row) => row.slug === slug);
}

export function searchCatalog(params: {
  query: string;
  group?: SplitGroup | 'all';
  movement?: MovementKind | 'all';
  pattern?: MovementPattern | 'all';
  equipment?: string | 'all';
}): CatalogExercise[] {
  const q = params.query.trim().toLowerCase();
  const group = params.group ?? 'all';
  const movement = params.movement ?? 'all';
  const pattern = params.pattern ?? 'all';
  const equipment = params.equipment ?? 'all';
  return GYM_CATALOG.filter((row) => {
    if (group !== 'all' && row.group !== group) return false;
    if (movement !== 'all' && row.movement !== movement) return false;
    if (pattern !== 'all' && row.movementPattern !== pattern) return false;
    if (equipment !== 'all' && !matchesGear(row, equipment)) {
      return false;
    }
    if (!q) return true;
    const hay = [
      row.name,
      row.slug,
      row.familyId,
      row.primaryMuscle,
      row.group,
      row.equipment,
      row.movementPattern,
      row.trackingMode,
      row.laterality,
      ...row.aliases,
      ...row.nameTl,
      ...row.secondaryMuscles,
      ...row.requiredEquipment,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function catalogPromptLines(): string {
  return catalogForAi(gymKb);
}

export function listedSubstitutes(slug: string, limit = 5) {
  return substitutesFor(slug, gymKb, limit);
}
