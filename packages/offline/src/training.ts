import { estimateSetE1rm, restTimerDeadline } from '@kayamo/core';
import type {
  UserExerciseWrite,
  WorkoutPlanExerciseWrite,
  WorkoutPlanWrite,
  WorkoutSetWrite,
  WorkoutWrite,
} from '@kayamo/db';
import { incomingWins, omitServerCursor } from '@kayamo/db';
import {
  getOfflineDb,
  type LocalExercise,
  type LocalRestTimer,
  type LocalWorkout,
  type LocalWorkoutPlan,
  type LocalWorkoutPlanExercise,
  type LocalWorkoutSet,
} from './db';
import { logicalDateFromInstant } from './logical-date';
import { enqueueUpsert } from './queue';
import { drainQueue } from './sync';
import { createLocalCompanionEvent } from './journey';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function workoutPayload(row: LocalWorkout): WorkoutWrite {
  return omitServerCursor(row);
}

function setPayload(row: LocalWorkoutSet): WorkoutSetWrite {
  return omitServerCursor(row);
}

export async function startLocalWorkout(input: {
  userId: string;
  timeZone?: string;
  dayStartsAt?: string;
  notes?: string | null;
  planId?: string | null;
  planDayIndex?: number | null;
  isDeload?: boolean;
  id?: string;
  startedAt?: string;
}): Promise<LocalWorkout> {
  const at = input.startedAt ?? nowIso();
  const row: LocalWorkout = {
    id: input.id ?? newId(),
    user_id: input.userId,
    started_at: at,
    ended_at: null,
    logical_date: logicalDateFromInstant(at, input.timeZone, input.dayStartsAt),
    notes: input.notes ?? null,
    routine_id: null,
    plan_id: input.planId ?? null,
    plan_day_index: input.planDayIndex ?? null,
    status: 'active',
    is_deload: input.isDeload ?? false,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().workouts.put(row);
  await enqueueUpsert('workouts', row.id, workoutPayload(row));
  void drainQueue();
  return row;
}

export async function completeLocalWorkoutSet(input: {
  userId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseOrder: number;
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe?: number | null;
  rir?: number | null;
  setType?: LocalWorkoutSet['set_type'];
  supersetGroup?: string | null;
  restSeconds?: number | null;
  id?: string;
  completedAt?: string;
}): Promise<LocalWorkoutSet> {
  const db = getOfflineDb();
  const workout = await db.workouts.get(input.workoutId);
  if (
    !workout ||
    workout.user_id !== input.userId ||
    workout.deleted_at ||
    workout.status !== 'active'
  ) {
    throw new Error('Sets can only be added to an owned, active workout');
  }
  if (input.weightKg < 0 || input.reps < 0) throw new Error('Invalid set values');
  const at = input.completedAt ?? nowIso();
  const estimate = estimateSetE1rm(input.weightKg, input.reps);
  const setType = input.setType ?? 'normal';
  const row: LocalWorkoutSet = {
    id: input.id ?? newId(),
    user_id: input.userId,
    workout_id: input.workoutId,
    exercise_id: input.exerciseId,
    exercise_order: input.exerciseOrder,
    exercise_name_snapshot: input.exerciseName,
    set_index: input.setIndex,
    set_type: setType,
    superset_group: input.supersetGroup ?? null,
    weight_kg: input.weightKg.toString(),
    reps: input.reps,
    rpe: input.rpe?.toString() ?? null,
    rir: input.rir?.toString() ?? null,
    is_warmup: setType === 'warmup',
    completed_at: at,
    rest_seconds: input.restSeconds ?? null,
    e1rm_epley_kg: estimate.epleyKg?.toString() ?? null,
    e1rm_brzycki_kg: estimate.brzyckiKg?.toString() ?? null,
    e1rm_low_confidence: estimate.lowConfidence,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await db.workout_sets.put(row);
  await enqueueUpsert('workout_sets', row.id, setPayload(row));
  void drainQueue();
  return row;
}

export async function tombstoneLocalWorkoutSet(params: {
  id: string;
  userId: string;
}): Promise<LocalWorkoutSet | null> {
  const db = getOfflineDb();
  const existing = await db.workout_sets.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return null;
  const at = nowIso();
  const row: LocalWorkoutSet = { ...existing, deleted_at: at, updated_at: at };
  await db.workout_sets.put(row);
  await enqueueUpsert('workout_sets', row.id, setPayload(row));
  void drainQueue();
  return row;
}

export async function finishLocalWorkout(params: {
  id: string;
  userId: string;
  status?: 'completed' | 'abandoned';
}): Promise<LocalWorkout | null> {
  const db = getOfflineDb();
  const existing = await db.workouts.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return null;
  const at = nowIso();
  const row: LocalWorkout = {
    ...existing,
    ended_at: at,
    status: params.status ?? 'completed',
    updated_at: at,
  };
  await db.transaction('rw', db.workouts, db.rest_timers, async () => {
    await db.workouts.put(row);
    await db.rest_timers.delete(row.id);
  });
  await enqueueUpsert('workouts', row.id, workoutPayload(row));
  if (row.status === 'completed') {
    await createLocalCompanionEvent({
      userId: params.userId,
      eventType: 'workout_completed',
      sourceTable: 'workouts',
      sourceId: row.id,
      logicalDate: row.logical_date,
    });
  }
  void drainQueue();
  return row;
}

export async function tombstoneLocalWorkout(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const workout = await db.workouts.get(params.id);
  if (!workout || workout.user_id !== params.userId || workout.deleted_at) return;
  const at = nowIso();
  const sets = await db.workout_sets.where('workout_id').equals(params.id).toArray();
  const tombstonedWorkout = { ...workout, deleted_at: at, updated_at: at };
  await db.transaction('rw', db.workouts, db.workout_sets, db.rest_timers, async () => {
    await db.workouts.put(tombstonedWorkout);
    await db.workout_sets.bulkPut(
      sets.map((set) => ({ ...set, deleted_at: set.deleted_at ?? at, updated_at: at })),
    );
    await db.rest_timers.delete(params.id);
  });
  for (const set of sets) {
    const row = { ...set, deleted_at: set.deleted_at ?? at, updated_at: at };
    await enqueueUpsert('workout_sets', row.id, setPayload(row));
  }
  await enqueueUpsert('workouts', workout.id, workoutPayload(tombstonedWorkout));
  void drainQueue();
}

export async function listLocalWorkoutHistory(userId: string): Promise<LocalWorkout[]> {
  return (await getOfflineDb().workouts.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export async function listLocalWorkoutSets(
  workoutId: string,
): Promise<LocalWorkoutSet[]> {
  return (
    await getOfflineDb().workout_sets.where('workout_id').equals(workoutId).toArray()
  )
    .filter((row) => !row.deleted_at)
    .sort((a, b) => a.exercise_order - b.exercise_order || a.set_index - b.set_index);
}

export async function startLocalRestTimer(params: {
  workoutId: string;
  userId: string;
  seconds: number;
  startedAt?: string;
  performedSetId?: string | null;
}): Promise<LocalRestTimer> {
  const workout = await getOfflineDb().workouts.get(params.workoutId);
  if (!workout || workout.user_id !== params.userId || workout.status !== 'active') {
    throw new Error('Rest timer requires an owned, active workout');
  }
  const startedAt = params.startedAt ?? nowIso();
  const row: LocalRestTimer = {
    workout_id: params.workoutId,
    user_id: params.userId,
    started_at: startedAt,
    ends_at: restTimerDeadline(startedAt, params.seconds),
    performed_set_id: params.performedSetId ?? null,
    duration_seconds: params.seconds,
    status: 'running',
  };
  await getOfflineDb().rest_timers.put(row);
  return row;
}

export async function getLocalRestTimer(
  workoutId: string,
): Promise<LocalRestTimer | undefined> {
  return getOfflineDb().rest_timers.get(workoutId);
}

export async function clearLocalRestTimer(workoutId: string): Promise<void> {
  await getOfflineDb().rest_timers.delete(workoutId);
}

export async function extendLocalRestTimer(
  workoutId: string,
  extraSeconds: number,
): Promise<LocalRestTimer | undefined> {
  if (!Number.isInteger(extraSeconds) || extraSeconds === 0) {
    throw new Error('Rest extension must be a nonzero integer');
  }
  const existing = await getOfflineDb().rest_timers.get(workoutId);
  if (!existing) return undefined;
  const base = Math.max(Date.now(), Date.parse(existing.ends_at));
  const row: LocalRestTimer = {
    ...existing,
    ends_at: new Date(base + extraSeconds * 1_000).toISOString(),
    status: 'running',
  };
  await getOfflineDb().rest_timers.put(row);
  return row;
}

export async function saveLocalWorkoutPlan(
  input: Omit<WorkoutPlanWrite, 'id' | 'updated_at'> & { id?: string },
): Promise<LocalWorkoutPlan> {
  const at = nowIso();
  const row: LocalWorkoutPlan = {
    ...input,
    description: input.description ?? null,
    active: input.active ?? true,
    id: input.id ?? newId(),
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().workout_plans.put(row);
  await enqueueUpsert('workout_plans', row.id, omitServerCursor(row));
  void drainQueue();
  return row;
}

export async function saveLocalWorkoutPlanExercise(
  input: Omit<WorkoutPlanExerciseWrite, 'id' | 'updated_at'> & { id?: string },
): Promise<LocalWorkoutPlanExercise> {
  const plan = await getOfflineDb().workout_plans.get(input.plan_id);
  if (!plan || plan.user_id !== input.user_id || plan.deleted_at) {
    throw new Error('Plan exercise requires an owned, live plan');
  }
  const at = nowIso();
  const row: LocalWorkoutPlanExercise = {
    ...input,
    rest_seconds: input.rest_seconds ?? 120,
    superset_group: input.superset_group ?? null,
    notes: input.notes ?? null,
    id: input.id ?? newId(),
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().workout_plan_exercises.put(row);
  await enqueueUpsert('workout_plan_exercises', row.id, omitServerCursor(row));
  void drainQueue();
  return row;
}

export async function mergeRemoteWorkouts(rows: LocalWorkout[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.workouts.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.workouts.put(row);
    }
  }
}

export async function mergeRemoteWorkoutSets(rows: LocalWorkoutSet[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.workout_sets.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.workout_sets.put(row);
    }
  }
}

export async function mergeRemoteExercises(rows: LocalExercise[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.exercises.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.exercises.put(row);
    }
  }
}

export async function mergeRemoteWorkoutPlans(rows: LocalWorkoutPlan[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.workout_plans.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.workout_plans.put(row);
    }
  }
}

export async function mergeRemoteWorkoutPlanExercises(
  rows: LocalWorkoutPlanExercise[],
): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.workout_plan_exercises.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.workout_plan_exercises.put(row);
    }
  }
}

export function userExercisePayload(row: LocalExercise): UserExerciseWrite {
  return { ...omitServerCursor(row), source: 'user' };
}
