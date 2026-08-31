import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOfflineDb } from './db';
import {
  addGymSessionItem,
  duplicateGymSessionItem,
  gymDraftSessionId,
  listGymPlannedSets,
  listGymSessionItems,
  updateGymPlannedSet,
} from './gym-session';
import {
  completeLocalWorkoutSet,
  listLocalWorkoutSets,
  startLocalRestTimer,
  startLocalWorkout,
  tombstoneLocalWorkoutSet,
} from './training';

vi.mock('./sync', async () => {
  const status = await import('./status');
  return {
    drainQueue: vi.fn(async () => undefined),
    startSync: vi.fn(),
    getSyncStatusSnapshot: vi.fn(() => ({ kind: 'synced' })),
    bindStatusStore: status.subscribeSyncStatus,
    resumeSync: vi.fn(),
  };
});

describe('gym session frame', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('keeps two squat instances as separate plan items', async () => {
    const sessionId = gymDraftSessionId('user-a');
    const heavy = await addGymSessionItem({
      userId: 'user-a',
      sessionId,
      slug: 'BARBELL_BACK_SQUAT',
      exerciseName: 'Squat — Heavy',
      targetSets: 3,
      targetReps: 3,
    });
    const backoff = await duplicateGymSessionItem({
      userId: 'user-a',
      itemId: heavy.id,
      note: 'Squat — Technique',
    });
    const rows = await listGymSessionItems('user-a', sessionId);
    expect(rows).toHaveLength(2);
    expect(heavy.id).not.toBe(backoff?.id);
    expect(rows.map((row) => row.slug)).toEqual(['BARBELL_BACK_SQUAT', 'BARBELL_BACK_SQUAT']);
  });

  it('does not rewrite planned targets when a lighter set is logged', async () => {
    const workout = await startLocalWorkout({ userId: 'user-a' });
    const item = await addGymSessionItem({
      userId: 'user-a',
      sessionId: workout.id,
      slug: 'BARBELL_BENCH_PRESS',
      exerciseName: 'Bench Press',
      targetSets: 1,
      targetReps: 8,
      targetWeightKg: 80,
    });
    const [planned] = await listGymPlannedSets('user-a', item.id);
    expect(planned?.target_reps).toBe(8);
    expect(planned?.target_weight_kg).toBe(80);
    const performed = await completeLocalWorkoutSet({
      userId: 'user-a',
      workoutId: workout.id,
      exerciseId: '40000000-0000-4000-8000-000000000003',
      exerciseName: 'Bench Press',
      exerciseOrder: 0,
      setIndex: 0,
      weightKg: 80,
      reps: 6,
      restSeconds: planned?.rest_seconds ?? 150,
    });
    await updateGymPlannedSet({
      id: planned!.id,
      userId: 'user-a',
      performed_set_id: performed.id,
    });
    const still = await listGymPlannedSets('user-a', item.id);
    expect(still[0]?.target_reps).toBe(8);
    expect(still[0]?.target_weight_kg).toBe(80);
    expect(performed.reps).toBe(6);
  });

  it('starts a rest timer from the completed set and undoes the set', async () => {
    const workout = await startLocalWorkout({ userId: 'user-a' });
    const performed = await completeLocalWorkoutSet({
      userId: 'user-a',
      workoutId: workout.id,
      exerciseId: '40000000-0000-4000-8000-000000000004',
      exerciseName: 'Bench Press',
      exerciseOrder: 0,
      setIndex: 0,
      weightKg: 80,
      reps: 8,
      restSeconds: 150,
    });
    const timer = await startLocalRestTimer({
      workoutId: workout.id,
      userId: 'user-a',
      seconds: 150,
      performedSetId: performed.id,
    });
    expect(timer.duration_seconds).toBe(150);
    expect(timer.performed_set_id).toBe(performed.id);
    await tombstoneLocalWorkoutSet({ id: performed.id, userId: 'user-a' });
    expect(await listLocalWorkoutSets(workout.id)).toEqual([]);
  });
});
