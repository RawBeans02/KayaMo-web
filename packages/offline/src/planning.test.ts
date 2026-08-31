import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOfflineDb, resetOfflineDb } from './db';
import {
  completeLocalRoutine,
  createLocalRoutine,
  createLocalTask,
  listLocalRoutineCompletions,
  listLocalRoutines,
  listLocalOverdueTasks,
  listLocalTasks,
  listLocalTasksForDate,
  setLocalTaskScheduledFor,
  mergeRemoteRoutines,
  mergeRemoteRoutineCompletions,
  mergeRemoteTasks,
  tombstoneLocalRoutine,
  tombstoneLocalRoutineCompletion,
  tombstoneLocalTask,
  updateLocalTask,
} from './planning';
import { pendingCount } from './queue';

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

describe('offline planning', () => {
  beforeEach(async () => {
    await resetOfflineDb();
  });

  afterEach(async () => {
    await resetOfflineDb();
  });

  it('creates and completes a routine once per logical day', async () => {
    const routine = await createLocalRoutine({
      userId: 'user-a',
      title: 'Morning walk',
      scheduleDays: [6],
    });
    const first = await completeLocalRoutine({
      userId: 'user-a',
      routineId: routine.id,
      logicalDate: '2026-08-22',
    });
    const duplicate = await completeLocalRoutine({
      userId: 'user-a',
      routineId: routine.id,
      logicalDate: '2026-08-22',
    });

    expect(duplicate.id).toBe(first.id);
    expect(await listLocalRoutineCompletions('user-a', '2026-08-22')).toHaveLength(1);
    expect(await pendingCount()).toBe(3);
    expect(await getOfflineDb().companion_events.count()).toBe(1);
  });

  it('moves a task off today without deleting it', async () => {
    const live = await createLocalTask({
      userId: 'user-a',
      title: 'Email Ate Rina',
      scheduledFor: '2026-08-24',
    });
    await setLocalTaskScheduledFor({ id: live.id, userId: 'user-a', scheduledFor: null });
    expect(await listLocalTasksForDate('user-a', '2026-08-24')).toEqual([]);
    expect((await listLocalTasks('user-a')).map((row) => row.id)).toEqual([live.id]);
    expect((await getOfflineDb().tasks.get(live.id))?.scheduled_for).toBeNull();
    expect((await getOfflineDb().tasks.get(live.id))?.deleted_at).toBeNull();
  });

  it('edits a title and lists overdue off today', async () => {
    const now = '2026-09-01T04:00:00.000Z';
    const missed = await createLocalTask({
      userId: 'user-a',
      title: 'Submit form',
      scheduledFor: '2026-08-30',
    });
    const due = await createLocalTask({
      userId: 'user-a',
      title: 'Pay bill',
      dueAt: '2026-08-31T00:00:00.000Z',
    });
    const today = await createLocalTask({
      userId: 'user-a',
      title: 'Stay on today',
      scheduledFor: '2026-09-01',
    });
    const renamed = await updateLocalTask({
      id: missed.id,
      userId: 'user-a',
      title: 'Submit registrar form',
    });
    expect(renamed?.title).toBe('Submit registrar form');
    const overdue = await listLocalOverdueTasks('user-a', '2026-09-01', now);
    expect(overdue.map((row) => row.id).sort()).toEqual([due.id, missed.id].sort());
    expect(overdue.map((row) => row.id)).not.toContain(today.id);
  });

  it('keeps a task tombstoned after a stale sync round-trip', async () => {
    const live = await createLocalTask({
      id: '10000000-0000-4000-8000-000000000001',
      userId: 'user-a',
      title: 'Prepare breakfast',
      scheduledFor: '2026-08-22',
    });
    await tombstoneLocalTask({ id: live.id, userId: 'user-a' });

    await mergeRemoteTasks([{ ...live, updated_at: '2000-01-01T00:00:00.000Z' }]);

    expect(await listLocalTasksForDate('user-a', '2026-08-22')).toEqual([]);
    const raw = await getOfflineDb().tasks.get(live.id);
    expect(raw?.deleted_at).toBeTruthy();
    expect(await pendingCount()).toBe(1);
  });

  it('keeps a routine tombstoned after a stale sync round-trip', async () => {
    const live = await createLocalRoutine({
      id: '20000000-0000-4000-8000-000000000001',
      userId: 'user-a',
      title: 'Read for ten minutes',
    });
    await tombstoneLocalRoutine({ id: live.id, userId: 'user-a' });

    await mergeRemoteRoutines([{ ...live, updated_at: '2000-01-01T00:00:00.000Z' }]);

    expect(await listLocalRoutines('user-a')).toEqual([]);
    const raw = await getOfflineDb().routines.get(live.id);
    expect(raw?.deleted_at).toBeTruthy();
    expect(await pendingCount()).toBe(1);
  });

  it('keeps a routine completion tombstoned after a stale sync round-trip', async () => {
    const routine = await createLocalRoutine({
      userId: 'user-a',
      title: 'Evening reflection',
    });
    const live = await completeLocalRoutine({
      userId: 'user-a',
      routineId: routine.id,
      logicalDate: '2026-08-22',
    });
    await tombstoneLocalRoutineCompletion({ id: live.id, userId: 'user-a' });

    await mergeRemoteRoutineCompletions([
      { ...live, updated_at: '2000-01-01T00:00:00.000Z' },
    ]);

    expect(await listLocalRoutineCompletions('user-a', '2026-08-22')).toEqual([]);
    expect(
      (await getOfflineDb().routine_completions.get(live.id))?.deleted_at,
    ).toBeTruthy();
    expect(await pendingCount()).toBe(3);
  });
});
