import { describe, expect, it } from 'vitest';
import { familyOverlapWarnings } from './redundancy';
import type { CatalogExercise } from './kb/types';

const bench = {
  slug: 'BARBELL_BENCH_PRESS',
  name: 'Barbell Bench Press',
  familyId: 'bench_press',
} as CatalogExercise;

const incline = {
  slug: 'INCLINE_DB_PRESS',
  name: 'Incline DB Press',
  familyId: 'bench_press',
} as CatalogExercise;

describe('family overlap warnings', () => {
  it('warns without blocking two lifts in the same family', () => {
    const warnings = familyOverlapWarnings(
      [
        { slug: bench.slug, exerciseName: bench.name, familyId: bench.familyId },
        { slug: incline.slug, exerciseName: incline.name, familyId: incline.familyId },
      ],
      [bench, incline],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('intentional');
  });
});
