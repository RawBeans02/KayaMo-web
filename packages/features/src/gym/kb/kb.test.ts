import { describe, expect, it } from 'vitest';
import {
  buildGymKnowledgeBase,
  catalogForAi,
  substitutesFor,
  substitutionScore,
  validateGymKnowledgeBase,
} from './assemble';

describe('gym knowledge base', () => {
  const kb = buildGymKnowledgeBase();

  it('validates unique slugs and known equipment', () => {
    expect(validateGymKnowledgeBase(kb)).toEqual([]);
    expect(kb.exercises.length).toBeGreaterThan(250);
  });

  it('ranks barbell bench substitutes by pattern, not random chest work', () => {
    const swaps = substitutesFor('BARBELL_BENCH_PRESS', kb, 8);
    const slugs = swaps.map((row) => row.exercise.slug);
    expect(slugs).toContain('DUMBBELL_BENCH_PRESS');
    const db = swaps.find((row) => row.exercise.slug === 'DUMBBELL_BENCH_PRESS');
    expect(db?.kind).toBe('best');
    expect(db?.score ?? 0).toBeGreaterThanOrEqual(85);

    const bench = kb.exercises.find((row) => row.slug === 'BARBELL_BENCH_PRESS');
    const machine = kb.exercises.find((row) => row.slug === 'MACHINE_CHEST_PRESS');
    const fly = kb.exercises.find((row) => row.slug === 'CABLE_FLY');
    expect(bench && machine && fly).toBeTruthy();
    if (!bench || !machine || !fly) return;
    expect(substitutionScore(bench, machine)).toBeGreaterThan(substitutionScore(bench, fly));
  });

  it('keeps restricted lifts out of the consult catalog', () => {
    const prompt = catalogForAi(kb);
    expect(prompt).not.toContain('SISSY_SQUAT');
    expect(prompt).not.toContain('POWER_SNATCH');
    expect(prompt).toContain('BARBELL_BENCH_PRESS');
  });
});
