import type { CatalogExercise, GymKnowledgeBase, Relationship } from './types';
import type { CompiledGymKb } from './from-csv';
import compiledJson from './compiled.json';

const compiled = compiledJson as CompiledGymKb;

function equipmentOverlap(a: CatalogExercise, b: CatalogExercise): number {
  const left = new Set(a.requiredEquipment);
  return b.requiredEquipment.filter((id) => left.has(id)).length;
}

export function substitutionScore(from: CatalogExercise, to: CatalogExercise): number {
  if (from.slug === to.slug) return 0;
  let score = 0;
  if (from.movementPattern === to.movementPattern) score += 40;
  if (from.primaryMuscle === to.primaryMuscle) score += 20;
  if (from.movement === to.movement) score += 15;
  if (from.force === to.force) score += 10;
  if (from.laterality === to.laterality) score += 5;
  if (from.group === to.group) score += 5;
  score += Math.min(10, equipmentOverlap(from, to) * 5);
  if (from.difficulty === to.difficulty) score += 5;
  if (from.familyId === to.familyId) score += 8;
  return Math.min(100, score);
}

export function inferRelationships(exercises: CatalogExercise[]): Relationship[] {
  const out: Relationship[] = [];
  for (const from of exercises) {
    const ranked = exercises
      .map((to) => ({ to, score: substitutionScore(from, to) }))
      .filter((row) => row.score >= 55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    for (const row of ranked) {
      const kind =
        row.score >= 85 ? 'best' : row.score >= 70 ? 'acceptable' : 'different_purpose';
      out.push({ fromId: from.slug, toId: row.to.slug, kind, score: row.score });
    }
  }
  return out;
}

export function substitutesFor(
  slug: string,
  kb: GymKnowledgeBase,
  limit = 6,
): Array<{ exercise: CatalogExercise; score: number; kind: Relationship['kind'] }> {
  const bySlug = new Map(kb.exercises.map((row) => [row.slug, row]));
  return kb.relationships
    .filter((row) => row.fromId === slug)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .flatMap((row) => {
      const exercise = bySlug.get(row.toId);
      if (!exercise) return [];
      return [{ exercise, score: row.score, kind: row.kind }];
    });
}

export function hydrateGymKnowledgeBase(data: CompiledGymKb): GymKnowledgeBase {
  return {
    version: 1,
    muscles: data.muscles,
    equipment: data.equipment,
    patterns: data.patterns,
    exercises: data.exercises,
    relationships: inferRelationships(data.exercises),
    rules: data.rules,
  };
}

export function buildGymKnowledgeBase(): GymKnowledgeBase {
  return hydrateGymKnowledgeBase(compiled);
}

export function validateGymKnowledgeBase(kb: GymKnowledgeBase): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();
  const equipmentIds = new Set(kb.equipment.map((row) => row.id));
  for (const row of kb.exercises) {
    if (slugs.has(row.slug)) errors.push(`duplicate slug ${row.slug}`);
    slugs.add(row.slug);
    if (row.defaultRepMin > row.defaultRepMax) errors.push(`${row.slug} has inverted reps`);
    for (const gear of row.requiredEquipment) {
      if (!equipmentIds.has(gear)) errors.push(`${row.slug} unknown equipment ${gear}`);
    }
  }
  for (const rel of kb.relationships) {
    if (!slugs.has(rel.fromId) || !slugs.has(rel.toId)) {
      errors.push(`relationship ${rel.fromId}→${rel.toId} missing exercise`);
    }
  }
  return errors;
}

const CONSULT_CLASSES = new Set(['resistance', 'core', 'functional', 'power']);

export function catalogForAi(kb: GymKnowledgeBase): string {
  return kb.exercises
    .filter((row) => row.aiSelectionAllowed && CONSULT_CLASSES.has(row.exerciseClass))
    .map(
      (row) =>
        `${row.slug} | ${row.name} | ${row.movementPattern} | ${row.primaryMuscle} | ${row.movement} | ${row.group} | ${row.equipment} | ${row.trackingMode} | ${row.difficulty}`,
    )
    .join('\n');
}
