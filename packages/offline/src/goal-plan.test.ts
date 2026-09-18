import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { getOfflineDb, resetOfflineDb, setOfflineUserScope } from './db';
import { createLocalGoalPlan } from './goal-plan';
import { drainQueue } from './sync';

vi.mock('./sync', () => ({ drainQueue: vi.fn(async () => undefined) }));
const input = {
  id: 'c1000000-0000-4000-8000-000000000001',
  userId: 'user-a',
  title: 'Write a chapter',
  firstStep: 'Write one paragraph',
  doneLooks: 'Chapter reviewed',
  logicalDate: '2026-09-12',
};
describe('atomic goal plan confirmation', () => {
  beforeEach(async () => {
    await resetOfflineDb();
    await setOfflineUserScope(input.userId);
    vi.clearAllMocks();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await resetOfflineDb();
  });
  it('commits the goal, two milestones, task and outbox together', async () => {
    const row = await createLocalGoalPlan(input);
    const db = getOfflineDb();
    expect(row.id).toBe(input.id);
    expect(await db.goals.count()).toBe(1);
    expect(await db.goal_milestones.count()).toBe(2);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.sync_queue.count()).toBe(4);
    expect(
      (await db.sync_queue.toArray()).every((item) => item.userId === input.userId),
    ).toBe(true);
    expect(drainQueue).toHaveBeenCalledTimes(1);
  });
  it.each(['milestones', 'task', 'outbox'] as const)(
    'rolls back every record if %s fails and retries without duplicates',
    async (stage) => {
      const db = getOfflineDb();
      if (stage === 'milestones')
        vi.spyOn(db.goal_milestones, 'bulkAdd').mockRejectedValueOnce(
          new Error('simulated quota failure'),
        );
      if (stage === 'task')
        vi.spyOn(db.tasks, 'add').mockRejectedValueOnce(
          new Error('simulated quota failure'),
        );
      if (stage === 'outbox')
        vi.spyOn(db.sync_queue, 'bulkAdd').mockRejectedValueOnce(
          new Error('simulated quota failure'),
        );
      await expect(createLocalGoalPlan(input)).rejects.toThrow('simulated quota failure');
      for (const table of [db.goals, db.goal_milestones, db.tasks, db.sync_queue])
        expect(await table.count()).toBe(0);
      expect(drainQueue).not.toHaveBeenCalled();
      await createLocalGoalPlan(input);
      expect(await db.goals.count()).toBe(1);
      expect(await db.goal_milestones.count()).toBe(2);
      expect(await db.tasks.count()).toBe(1);
      expect(await db.sync_queue.count()).toBe(4);
    },
  );
  it('makes duplicate and concurrent confirmation retries idempotent', async () => {
    const rows = await Promise.all([
      createLocalGoalPlan(input),
      createLocalGoalPlan(input),
    ]);
    expect(rows[0]).toEqual(rows[1]);
    await createLocalGoalPlan({ ...input, title: 'Should not overwrite the saved goal' });
    expect((await getOfflineDb().goals.get(input.id))?.title).toBe(input.title);
    expect(await getOfflineDb().tasks.count()).toBe(1);
    expect(await getOfflineDb().goal_milestones.count()).toBe(2);
  });
  it('retains idempotency after reopening the account database', async () => {
    await createLocalGoalPlan(input);
    getOfflineDb().close();
    await setOfflineUserScope(input.userId);
    await createLocalGoalPlan(input);
    expect(await getOfflineDb().goals.count()).toBe(1);
    expect(await getOfflineDb().tasks.count()).toBe(1);
    expect(await getOfflineDb().sync_queue.count()).toBe(4);
  });
  it('does not resurrect a deleted goal through a stale confirmation', async () => {
    await createLocalGoalPlan(input);
    await getOfflineDb().goals.update(input.id, { deleted_at: new Date().toISOString() });
    await expect(createLocalGoalPlan(input)).rejects.toThrow('unavailable');
    expect(await getOfflineDb().tasks.count()).toBe(1);
  });
  it('rolls back if the active account changes before the outbox commits', async () => {
    const db = getOfflineDb();
    let transition: Promise<unknown> | undefined;
    vi.spyOn(db.sync_queue, 'bulkAdd').mockImplementationOnce(() => {
      transition = setOfflineUserScope('user-b');
      return Dexie.Promise.resolve('interrupted');
    });
    await expect(createLocalGoalPlan(input)).rejects.toThrow();
    await transition;
    expect(await getOfflineDb().goals.count()).toBe(0);
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
    await setOfflineUserScope(input.userId);
    for (const table of [
      getOfflineDb().goals,
      getOfflineDb().goal_milestones,
      getOfflineDb().tasks,
      getOfflineDb().sync_queue,
    ]) {
      expect(await table.count()).toBe(0);
    }
  });
  it('rejects mismatched account writes before persisting anything', async () => {
    await setOfflineUserScope('user-b');
    await expect(createLocalGoalPlan(input)).rejects.toThrow('active account');
    expect(await getOfflineDb().goals.count()).toBe(0);
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });
});
