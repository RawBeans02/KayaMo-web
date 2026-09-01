import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOfflineDb } from './db';
import { createLocalTask, setLocalTaskCompleted } from './planning';
import {
  addLocalDependency,
  createLocalProject,
  createLocalTimeBlock,
  listLocalTimeBlocks,
  nextRecurrenceDate,
  spawnRecurrenceIfNeeded,
  taskIsBlocked,
  undoLatestMusAction,
  updateLocalTimeBlock,
  recordMusAction,
  upsertLocalTaskMeta,
  getLocalTaskMeta,
} from './schedule';

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

describe('local schedule', () => {
  beforeEach(async () => {
    await resetOfflineDb();
  });
  afterEach(async () => {
    await resetOfflineDb();
  });

  it('moves a block and undoes it', async () => {
    const block = await createLocalTimeBlock({
      userId: 'user-a',
      logicalDate: '2026-09-01',
      title: 'Gym',
      startMin: 14 * 60,
      endMin: 15 * 60 + 30,
    });
    await recordMusAction({
      userId: 'user-a',
      action: 'move_time_block',
      summary: 'Gym 14:00 → 17:00',
      inverse: { kind: 'restore_block', id: block.id, start_min: block.start_min, end_min: block.end_min },
    });
    await updateLocalTimeBlock({
      id: block.id,
      userId: 'user-a',
      start_min: 17 * 60,
      end_min: 18 * 60 + 30,
    });
    await undoLatestMusAction('user-a');
    const rows = await listLocalTimeBlocks('user-a', '2026-09-01');
    expect(rows[0]?.start_min).toBe(14 * 60);
  });

  it('blocks a dependent task until the prerequisite is done', async () => {
    const first = await createLocalTask({ userId: 'user-a', title: 'Get COE' });
    const last = await createLocalTask({ userId: 'user-a', title: 'Submit' });
    await addLocalDependency({ userId: 'user-a', taskId: first.id, blocksTaskId: last.id });
    expect(await taskIsBlocked('user-a', last.id)).toBe(true);
    await setLocalTaskCompleted({ id: first.id, userId: 'user-a', completed: true });
    expect(await taskIsBlocked('user-a', last.id)).toBe(false);
  });

  it('computes weekday recurrence past the weekend', () => {
    expect(nextRecurrenceDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(nextRecurrenceDate('2026-09-04', 'weekdays', 1)).toBe('2026-09-07');
  });

  it('spawns the next recurring copy after completion', async () => {
    const live = await createLocalTask({
      userId: 'user-a',
      title: 'Vitamins',
      scheduledFor: '2026-09-01',
    });
    await upsertLocalTaskMeta({
      taskId: live.id,
      userId: 'user-a',
      recurrence: 'daily',
      recurrence_interval_days: 3,
    });
    const next = await spawnRecurrenceIfNeeded({
      userId: 'user-a',
      task: live,
      today: '2026-09-01',
    });
    expect(next?.scheduled_for).toBe('2026-09-04');
    const again = await spawnRecurrenceIfNeeded({
      userId: 'user-a',
      task: live,
      today: '2026-09-01',
    });
    expect(again?.id).toBe(next?.id);
    expect(await getLocalTaskMeta(next!.id)).toMatchObject({
      recurrence_interval_days: 3,
      instance_of: live.id,
    });
    expect(await createLocalProject({ userId: 'user-a', title: 'Teacher training' })).toMatchObject({
      title: 'Teacher training',
    });
  });
});
