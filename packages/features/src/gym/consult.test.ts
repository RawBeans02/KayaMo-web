import { describe, expect, it } from 'vitest';
import { bindConsultToCatalog } from './consult';
import { lastLoadKg } from './last-load';

describe('bindConsultToCatalog', () => {
  it('keeps catalog slugs and drops invented ones', () => {
    const bound = bindConsultToCatalog({
      splitLabel: 'Push',
      rationale: 'Press first, then arms.',
      picks: [
        { slug: 'BARBELL_BENCH_PRESS', sets: 3, reps: 8, why: 'Main press' },
        { slug: 'not-a-real-lift', sets: 3, reps: 10, why: 'Invented' },
        { slug: 'BARBELL_BENCH_PRESS', sets: 4, reps: 6, why: 'Duplicate' },
        { slug: 'DUMBBELL_LATERAL_RAISE', sets: 3, reps: 12, why: 'Side delts' },
        { slug: 'CABLE_TRICEPS_PUSHDOWN', sets: 3, reps: 12, why: 'Arms' },
      ],
    });
    expect(bound.picks.map((row) => row.exercise.slug)).toEqual([
      'BARBELL_BENCH_PRESS',
      'DUMBBELL_LATERAL_RAISE',
      'CABLE_TRICEPS_PUSHDOWN',
    ]);
    expect(bound.droppedSlugs).toEqual(['not-a-real-lift', 'BARBELL_BENCH_PRESS']);
  });
});

describe('lastLoadKg', () => {
  it('returns the newest matching snapshot', () => {
    expect(
      lastLoadKg(
        [
          {
            exercise_name_snapshot: 'Back squat',
            weight_kg: '80',
            completed_at: '2026-08-31T10:00:00.000Z',
          },
          {
            exercise_name_snapshot: 'Back squat',
            weight_kg: '85',
            completed_at: '2026-09-01T10:00:00.000Z',
          },
          {
            exercise_name_snapshot: 'Barbell bench press',
            weight_kg: '60',
            completed_at: '2026-09-01T11:00:00.000Z',
          },
        ],
        'back squat',
      ),
    ).toBe('85');
  });
});
