import { describe, expect, it } from 'vitest';
import { lastLoadKg, lastSessionSets } from './last-load';

describe('last session reference', () => {
  it('returns the latest working load and the last session set list', () => {
    const sets = [
      {
        workout_id: 'w1',
        exercise_name_snapshot: 'Bench Press',
        set_index: 0,
        weight_kg: '80',
        reps: 8,
        is_warmup: false,
        completed_at: '2026-08-20T10:00:00.000Z',
      },
      {
        workout_id: 'w2',
        exercise_name_snapshot: 'Bench Press',
        set_index: 0,
        weight_kg: '80',
        reps: 8,
        is_warmup: false,
        completed_at: '2026-08-27T10:00:00.000Z',
      },
      {
        workout_id: 'w2',
        exercise_name_snapshot: 'Bench Press',
        set_index: 1,
        weight_kg: '80',
        reps: 7,
        is_warmup: false,
        completed_at: '2026-08-27T10:04:00.000Z',
      },
    ];
    expect(lastLoadKg(sets, 'Bench Press')).toBe('80');
    expect(lastSessionSets(sets, 'Bench Press')).toEqual([
      { setIndex: 0, weightKg: '80', reps: 8, isWarmup: false },
      { setIndex: 1, weightKg: '80', reps: 7, isWarmup: false },
    ]);
  });
});
