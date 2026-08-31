import { exerciseBySlug, type CatalogExercise } from './library';
import type { GymConsult } from './consult-schema';

export type BoundConsultPick = {
  exercise: CatalogExercise;
  sets: number;
  reps: number;
  why: string;
};

export type BoundConsult = {
  splitLabel: string;
  rationale: string;
  picks: BoundConsultPick[];
  droppedSlugs: string[];
};

/** LLM slugs that are not in the catalog are dropped, never invented into the picker. */
export function bindConsultToCatalog(consult: GymConsult): BoundConsult {
  const droppedSlugs: string[] = [];
  const picks: BoundConsultPick[] = [];
  const seen = new Set<string>();
  for (const pick of consult.picks) {
    const exercise = exerciseBySlug(pick.slug);
    if (!exercise || seen.has(exercise.slug)) {
      droppedSlugs.push(pick.slug);
      continue;
    }
    seen.add(exercise.slug);
    picks.push({
      exercise,
      sets: pick.sets,
      reps: pick.reps,
      why: pick.why,
    });
  }
  return {
    splitLabel: consult.splitLabel,
    rationale: consult.rationale,
    picks,
    droppedSlugs,
  };
}
