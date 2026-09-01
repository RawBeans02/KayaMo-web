import {
  createMutationRevision,
  getOfflineDb,
  queueItemId,
  type KayaMoDB,
  type SyncQueueItem,
  type SyncableTable,
} from './db';
import { notifySyncStatus } from './status';

export const DEAD_LETTER_ATTEMPTS = 12;
export const DEAD_LETTER_HOLD_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export async function enqueueUpsert(
  table: SyncableTable,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getOfflineDb();
  const owner = payload.user_id ?? payload.created_by;
  if (typeof owner !== 'string' || owner.length === 0) {
    throw new Error(`Cannot queue ${table} without an owner`);
  }
  const item: SyncQueueItem = {
    id: queueItemId(table, entityId, owner),
    revision: createMutationRevision(),
    userId: owner,
    table,
    entityId,
    payload,
    attempt: 0,
    nextAttemptAt: Date.now(),
    lastError: null,
  };
  await db.sync_queue.put(item);
  notifySyncStatus();
}

export async function pendingCount(
  userId?: string,
  db: KayaMoDB = getOfflineDb(),
): Promise<number> {
  const counts = await syncQueueCounts(userId, db);
  return counts.pending;
}

export async function syncQueueCounts(
  userId?: string,
  db: KayaMoDB = getOfflineDb(),
): Promise<{ pending: number; needsAttention: number }> {
  const rows = userId
    ? await db.sync_queue.where('userId').equals(userId).toArray()
    : await db.sync_queue.toArray();
  let pending = 0;
  let needsAttention = 0;
  for (const item of rows) {
    if (item.attempt >= DEAD_LETTER_ATTEMPTS) needsAttention += 1;
    else pending += 1;
  }
  return { pending, needsAttention };
}

export async function dueQueueItems(
  now = Date.now(),
  userId?: string,
  db: KayaMoDB = getOfflineDb(),
): Promise<SyncQueueItem[]> {
  if (userId) {
    return db.sync_queue
      .where('[userId+nextAttemptAt]')
      .between([userId, 0], [userId, now], true, true)
      .sortBy('nextAttemptAt');
  }
  return db.sync_queue.where('nextAttemptAt').belowOrEqual(now).sortBy('nextAttemptAt');
}

export async function markQueueFailure(
  item: SyncQueueItem,
  nextAttemptAt: number,
  lastError: string,
  db: KayaMoDB = getOfflineDb(),
): Promise<boolean> {
  const updated = await db.transaction('rw', db.sync_queue, async () => {
    const current = await db.sync_queue.get(item.id);
    if (!current || current.revision !== item.revision) return false;
    const attempt = current.attempt + 1;
    const dead = attempt >= DEAD_LETTER_ATTEMPTS;
    await db.sync_queue.put({
      ...current,
      attempt,
      nextAttemptAt: dead ? Date.now() + DEAD_LETTER_HOLD_MS : nextAttemptAt,
      lastError: dead ? `needs_attention: ${lastError}` : lastError,
    });
    return true;
  });
  notifySyncStatus();
  return updated;
}

export async function reviveDeadLetterItems(
  userId: string,
  db: KayaMoDB = getOfflineDb(),
): Promise<number> {
  const rows = await db.sync_queue.where('userId').equals(userId).toArray();
  const dead = rows.filter((item) => item.attempt >= DEAD_LETTER_ATTEMPTS);
  const now = Date.now();
  for (const item of dead) {
    await db.sync_queue.put({
      ...item,
      attempt: 0,
      nextAttemptAt: now,
      lastError: item.lastError,
    });
  }
  if (dead.length > 0) notifySyncStatus();
  return dead.length;
}

export async function removeQueueItemIfUnchanged(
  item: SyncQueueItem,
  db: KayaMoDB = getOfflineDb(),
): Promise<boolean> {
  const removed = await db.transaction('rw', db.sync_queue, async () => {
    const current = await db.sync_queue.get(item.id);
    if (!current || current.revision !== item.revision) return false;
    await db.sync_queue.delete(item.id);
    return true;
  });
  notifySyncStatus();
  return removed;
}
