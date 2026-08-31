import { describe, expect, it } from 'vitest';
import { catalogExerciseId, GYM_CATALOG, searchCatalog } from './library';

describe('searchCatalog', () => {
  it('finds Taglish and English aliases', () => {
    expect(searchCatalog({ query: 'squat' }).some((row) => row.slug === 'BACK_SQUAT')).toBe(true);
    expect(searchCatalog({ query: 'RDL' }).some((row) => row.slug === 'ROMANIAN_DEADLIFT')).toBe(true);
    expect(searchCatalog({ query: 'bench' }).some((row) => row.slug === 'BARBELL_BENCH_PRESS')).toBe(true);
    expect(searchCatalog({ query: 'DB bench' }).some((row) => row.slug === 'DUMBBELL_BENCH_PRESS')).toBe(
      true,
    );
  });

  it('filters by movement pattern and equipment', () => {
    const rows = searchCatalog({
      query: '',
      pattern: 'horizontal_push',
      equipment: 'dumbbell',
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.movementPattern === 'horizontal_push')).toBe(true);
    expect(
      rows.every((row) => row.equipment === 'dumbbell' || row.requiredEquipment.includes('dumbbell')),
    ).toBe(true);
  });

  it('filters compound push lifts', () => {
    const rows = searchCatalog({ query: '', group: 'push', movement: 'compound' });
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((row) => row.group === 'push' && row.movement === 'compound')).toBe(true);
  });

  it('keeps catalog ids stable', () => {
    expect(catalogExerciseId('BACK_SQUAT')).toBe(catalogExerciseId('BACK_SQUAT'));
    expect(catalogExerciseId('BACK_SQUAT')).not.toBe(catalogExerciseId('BARBELL_BENCH_PRESS'));
  });

  it('covers both isolated and compound rows', () => {
    expect(GYM_CATALOG.some((row) => row.movement === 'isolated')).toBe(true);
    expect(GYM_CATALOG.some((row) => row.movement === 'compound')).toBe(true);
    expect(GYM_CATALOG.length).toBeGreaterThan(250);
  });

  it('uses unique slugs', () => {
    const slugs = GYM_CATALOG.map((row) => row.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
