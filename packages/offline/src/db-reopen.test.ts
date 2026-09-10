import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalTask, listLocalTasks } from './planning';
import {
  getOfflineDb,
  isDatabaseClosedError,
  recoverClosedOfflineDb,
  resetOfflineDb,
  reviveClosedOfflineDb,
  setOfflineUserScope,
  swallowClosedDbRejection,
} from './db';

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

describe('offline db reopen', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('detects Dexie closed-database errors', () => {
    expect(
      isDatabaseClosedError({ name: 'DatabaseClosedError', message: 'Database has been closed' }),
    ).toBe(true);
    expect(isDatabaseClosedError(new Error('boom'))).toBe(false);
  });

  it('keeps rows readable after the active connection is closed', async () => {
    await createLocalTask({
      userId: 'user-a',
      title: 'Keep after close',
      origin: 'user',
    });
    getOfflineDb().close();
    expect((await listLocalTasks('user-a')).map((row) => row.title)).toEqual(['Keep after close']);
  });

  it('revives a closed singleton without dropping local rows', async () => {
    await createLocalTask({ userId: 'user-a', title: 'A', origin: 'user' });
    getOfflineDb().close();
    const db = reviveClosedOfflineDb();
    expect((await db.tasks.toArray()).some((row) => row.title === 'A')).toBe(true);
  });

  it('retries a closed Dexie read after reopening', async () => {
    await createLocalTask({ userId: 'user-a', title: 'Retry me', origin: 'user' });
    getOfflineDb().close();
    let attempts = 0;
    const titles = await recoverClosedOfflineDb(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error('Database has been closed'), { name: 'DatabaseClosedError' });
      }
      return (await listLocalTasks('user-a')).map((row) => row.title);
    });
    expect(attempts).toBe(2);
    expect(titles).toEqual(['Retry me']);
  });

  it('retries a second time after another closed error', async () => {
    await createLocalTask({ userId: 'user-a', title: 'Retry twice', origin: 'user' });
    getOfflineDb().close();
    let attempts = 0;
    const titles = await recoverClosedOfflineDb(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new Error('Database has been closed'), { name: 'DatabaseClosedError' });
      }
      return (await listLocalTasks('user-a')).map((row) => row.title);
    });
    expect(attempts).toBe(3);
    expect(titles).toEqual(['Retry twice']);
  });

  it('swallows closed-database unhandled rejections without hiding other errors', () => {
    const closed = { preventDefault: vi.fn(), reason: { name: 'DatabaseClosedError', message: 'Database has been closed' } };
    const other = { preventDefault: vi.fn(), reason: new Error('boom') };
    expect(swallowClosedDbRejection(closed)).toBe(true);
    expect(closed.preventDefault).toHaveBeenCalledOnce();
    expect(swallowClosedDbRejection(other)).toBe(false);
    expect(other.preventDefault).not.toHaveBeenCalled();
  });

  it('reopens the same user scope after the connection is closed', async () => {
    await setOfflineUserScope('user-a');
    await createLocalTask({ userId: 'user-a', title: 'Scoped', origin: 'user' });
    getOfflineDb().close();
    await setOfflineUserScope('user-a');
    expect((await listLocalTasks('user-a')).map((row) => row.title)).toEqual(['Scoped']);
  });
});
