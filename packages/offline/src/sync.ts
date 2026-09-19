import type { Table } from 'dexie';
import type {
  DbClient,
} from '@kayamo/db';
import {
  isUnauthorizedError,
  upsertAgentMemory,
  upsertCocoConversation,
  upsertCocoMessage,
  recordCompanionEvent,
  upsertDailyLoopPreferences,
  upsertDailyPlan,
  upsertFoodEntry,
  upsertFocusSession,
  upsertGoal,
  upsertGoalMilestone,
  upsertCompass,
  upsertFutureSelf,
  upsertHabit,
  upsertHabitCompletion,
  upsertInboxItem,
  upsertMealTemplate,
  upsertPersonalRule,
  upsertRoutine,
  upsertRoutineCompletion,
  upsertTask,
  upsertUserExercise,
  upsertWeightLog,
  upsertWorkout,
  upsertWorkoutSet,
  upsertWorkoutPlan,
  upsertWorkoutPlanExercise,
} from '@kayamo/db';
import { backoffMs } from './backoff';
import {
  assertOfflineScope,
  getOfflineScope,
  installClosedDbRecovery,
  setOfflineUserScope,
  StaleOfflineScopeError,
  type OfflineScope,
  type SyncQueueItem,
  type SyncableTable,
  type KayaMoDB,
} from './db';
import { pullRemoteChanges, type PullPageFetcher, type PullStats } from './pull';
import {
  dueQueueItems,
  markQueueFailure,
  reviveDeadLetterItems,
  syncQueueCounts,
  removeQueueItemIfUnchanged,
} from './queue';
import { notifySyncStatus, subscribeSyncStatus } from './status';

export type SyncPushHandler = (
  client: DbClient,
  item: SyncQueueItem,
  scope?: OfflineScope,
) => Promise<void>;

export type SyncDeps = {
  getClient: () => DbClient;
  fetchPage?: PullPageFetcher;
  onTelemetry?: (event: SyncTelemetryEvent) => void;
  /**
   * No-account demo. When there is no Supabase session, scope the offline
   * database to this id instead of the signed-out one, which is deliberately
   * evacuated. Sync stays paused either way — a guest has nothing to push.
   */
  guestId?: string | null;
};

export type SyncTelemetryEvent = {
  kind: 'cycle-completed' | 'cycle-failed';
  durationMs: number;
  pushed: number;
  pulled: number;
  tombstones: number;
  skippedStale: number;
  conflicts: number;
  checkpointsAdvanced: number;
  failureCategory: string | null;
};

export type SyncStatus =
  | { kind: 'offline' }
  | { kind: 'pending'; count: number }
  | { kind: 'synced' }
  | { kind: 'degraded'; failedTables: number }
  | { kind: 'paused' }
  | { kind: 'local_db_error' }
  | { kind: 'needs_attention'; count: number };

const state = {
  paused: false,
  draining: false,
  syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
  needsAttention: 0,
  failedTables: 0,
  localDbError: false,
  timer: 0 as ReturnType<typeof setTimeout> | 0,
  deps: null as SyncDeps | null,
};

let snapshot: SyncStatus = { kind: 'synced' };

export function getSyncStatusSnapshot(): SyncStatus {
  return snapshot;
}

function setOnlineFlag(online: boolean): void {
  state.online = online;
  refreshSnapshot();
  notifySyncStatus();
}

function refreshSnapshot(): void {
  if (state.localDbError) {
    snapshot = { kind: 'local_db_error' };
    return;
  }
  if (!state.online) {
    snapshot = { kind: 'offline' };
    return;
  }
  if (state.paused) {
    snapshot = { kind: 'paused' };
    return;
  }
  if (state.needsAttention > 0) {
    snapshot = { kind: 'needs_attention', count: state.needsAttention };
    return;
  }
  if (state.pending > 0) {
    snapshot = { kind: 'pending', count: state.pending };
    return;
  }
  if (state.failedTables > 0) {
    snapshot = { kind: 'degraded', failedTables: state.failedTables };
    return;
  }
  snapshot = { kind: 'synced' };
}

async function refreshPending(userId?: string): Promise<void> {
  try {
    const counts = await syncQueueCounts(userId);
    state.pending = counts.pending;
    state.needsAttention = counts.needsAttention;
    state.localDbError = false;
  } catch {
    state.pending = 0;
    state.needsAttention = 0;
    state.localDbError = true;
  }
  refreshSnapshot();
  notifySyncStatus();
}

export function resumeSync(): void {
  state.paused = false;
  refreshSnapshot();
  notifySyncStatus();
  void syncNow();
}

export async function drainQueue(): Promise<void> {
  if (state.paused || state.draining || state.syncing) return;
  if (!state.online) {
    await refreshPending();
    return;
  }
  const deps = state.deps;
  if (!deps) return;

  state.draining = true;
  let userId: string | undefined;
  try {
    const client = deps.getClient();
    const { data } = await client.auth.getSession();
    if (!data.session) {
      state.paused = true;
      await setOfflineUserScope(null);
      return;
    }
    userId = data.session.user.id;
    const scope = await setOfflineUserScope(userId);
    const due = await dueQueueItems(Date.now(), userId, scope.db);
    for (const item of due) {
      if (state.paused) break;
      if (item.userId !== userId) continue;
      try {
        await applySyncQueueItem(client, item, scope);
        assertOfflineScope(scope);
        await removeQueueItemIfUnchanged(item, scope.db);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          state.paused = true;
          break;
        }
        if (error instanceof StaleOfflineScopeError) break;
        const delay = backoffMs(item.attempt);
        await markQueueFailure(item, Date.now() + delay, errorCode(error), scope.db);
        scheduleDrain(delay);
      }
    }
  } finally {
    state.draining = false;
    await refreshPending();
  }
}

export async function retryFailedSyncWrites(userId: string): Promise<number> {
  const revived = await reviveDeadLetterItems(userId);
  if (revived > 0) void drainQueue();
  return revived;
}

async function pushOutbound(
  client: DbClient,
  scope: OfflineScope,
  pushItem: SyncPushHandler = applySyncQueueItem,
): Promise<number> {
  const userId = scope.userId;
  if (!userId) return 0;
  let pushed = 0;
  const due = await dueQueueItems(Date.now(), userId, scope.db);
  for (const item of due) {
    if (state.paused || item.userId !== userId) break;
    try {
      await pushItem(client, item, scope);
      assertOfflineScope(scope);
      await removeQueueItemIfUnchanged(item, scope.db);
      pushed += 1;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        state.paused = true;
        throw error;
      }
      if (error instanceof StaleOfflineScopeError) throw error;
      const delay = backoffMs(item.attempt);
      await markQueueFailure(item, Date.now() + delay, errorCode(error), scope.db);
      scheduleSync(delay);
    }
  }
  return pushed;
}

export async function syncUserOnce(params: {
  client: DbClient;
  userId: string;
  namespace?: string;
  fetchPage?: PullPageFetcher;
  pushItem?: SyncPushHandler;
  tables?: readonly SyncableTable[];
}): Promise<{ pushed: number; pull: PullStats }> {
  const scope = await setOfflineUserScope(params.userId, { namespace: params.namespace });
  let pushed = 0;
  for (const item of await dueQueueItems(Date.now(), params.userId, scope.db)) {
    if (item.userId !== params.userId) continue;
    await (params.pushItem ?? applySyncQueueItem)(params.client, item, scope);
    assertOfflineScope(scope);
    await removeQueueItemIfUnchanged(item, scope.db);
    pushed += 1;
  }
  const pull = await pullRemoteChanges({
    client: params.client,
    userId: params.userId,
    fetchPage: params.fetchPage,
    tables: params.tables,
    scope,
  });
  await refreshPending(params.userId);
  return { pushed, pull };
}

export async function syncNow(): Promise<void> {
  if (state.paused || state.syncing || state.draining || !state.online || !state.deps)
    return;
  const startedAt = Date.now();
  const deps = state.deps;
  const client = deps.getClient();
  state.syncing = true;
  let pushed = 0;
  let pull: PullStats = {
    pulled: 0,
    applied: 0,
    tombstones: 0,
    skippedStale: 0,
    conflicts: 0,
    checkpointsAdvanced: 0,
    failedTables: [],
    deferredTables: [],
    nextRetryAt: null,
  };
  try {
    const { data } = await client.auth.getSession();
    if (!data.session) {
      state.paused = true;
      await setOfflineUserScope(null);
      return;
    }
    const userId = data.session.user.id;
    const scope = await setOfflineUserScope(userId);
    pushed = await pushOutbound(client, scope);
    if (!state.paused) {
      pull = await pullRemoteChanges({
        client,
        userId,
        fetchPage: deps.fetchPage,
        scope,
      });
    }
    state.failedTables = pull.failedTables.length + pull.deferredTables.length;
    deps.onTelemetry?.({
      kind: 'cycle-completed',
      durationMs: Date.now() - startedAt,
      pushed,
      pulled: pull.pulled,
      tombstones: pull.tombstones,
      skippedStale: pull.skippedStale,
      conflicts: pull.conflicts,
      checkpointsAdvanced: pull.checkpointsAdvanced,
      failureCategory: state.failedTables > 0 ? 'pull-table' : null,
    });
    if (pull.nextRetryAt !== null) {
      scheduleSync(Math.max(0, pull.nextRetryAt - Date.now()));
    }
  } catch (error) {
    const category = errorCode(error);
    if (isUnauthorizedError(error)) state.paused = true;
    deps.onTelemetry?.({
      kind: 'cycle-failed',
      durationMs: Date.now() - startedAt,
      pushed,
      pulled: pull.pulled,
      tombstones: pull.tombstones,
      skippedStale: pull.skippedStale,
      conflicts: pull.conflicts,
      checkpointsAdvanced: pull.checkpointsAdvanced,
      failureCategory: category,
    });
    if (!state.paused) scheduleSync(backoffMs(0));
  } finally {
    state.syncing = false;
    await refreshPending();
  }
}

function scheduleDrain(delayMs: number): void {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = 0;
    void drainQueue();
  }, delayMs);
}

function scheduleSync(delayMs: number): void {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = 0;
    void syncNow();
  }, delayMs);
}

function errorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  if (error instanceof Error) {
    if (
      error.message.toLowerCase().includes('failed to fetch') ||
      error.name === 'TypeError'
    ) {
      return 'network';
    }
    return 'error';
  }
  return 'error';
}


type PushHandler = {
  push: (client: DbClient, payload: Record<string, unknown>) => Promise<{ row: unknown }>;
  store: (db: KayaMoDB, row: unknown) => Promise<unknown>;
  /** The server assigned the id (companion_events): drop the local placeholder first. */
  reconcileId?: (db: KayaMoDB, localId: string, row: unknown) => Promise<void>;
};

function pushes<W, R>(
  push: (client: DbClient, write: W) => Promise<{ row: R | null }>,
  table: (db: KayaMoDB) => Table<R, string>,
): PushHandler {
  return {
    push: (client, payload) => push(client, payload as W),
    store: (db, row) => table(db).put(row as R),
  };
}

/**
 * One entry per syncable table: how a queued write reaches the server and
 * where the server's answer lands locally. `satisfies Record<SyncableTable,
 * PushHandler>` makes this exhaustive at compile time, so a table added to the
 * sync contract without a handler fails typecheck instead of throwing at
 * runtime. This replaced a 26-case switch and a 26-branch predicate that
 * nothing checked against each other.
 */
const PUSH_HANDLERS = {
  food_entries: pushes(upsertFoodEntry, (db) => db.food_entries),
  daily_plans: pushes(upsertDailyPlan, (db) => db.daily_plans),
  focus_sessions: pushes(upsertFocusSession, (db) => db.focus_sessions),
  daily_loop_preferences: pushes(upsertDailyLoopPreferences, (db) => db.daily_loop_preferences),
  weight_logs: pushes(upsertWeightLog, (db) => db.weight_logs),
  workouts: pushes(upsertWorkout, (db) => db.workouts),
  workout_sets: pushes(upsertWorkoutSet, (db) => db.workout_sets),
  exercises: pushes(upsertUserExercise, (db) => db.exercises),
  workout_plans: pushes(upsertWorkoutPlan, (db) => db.workout_plans),
  workout_plan_exercises: pushes(upsertWorkoutPlanExercise, (db) => db.workout_plan_exercises),
  goals: pushes(upsertGoal, (db) => db.goals),
  goal_milestones: pushes(upsertGoalMilestone, (db) => db.goal_milestones),
  habits: pushes(upsertHabit, (db) => db.habits),
  habit_completions: pushes(upsertHabitCompletion, (db) => db.habit_completions),
  companion_events: {
    ...pushes(recordCompanionEvent, (db) => db.companion_events),
    reconcileId: async (db, localId, row) => {
      if ((row as { id: string }).id !== localId) await db.companion_events.delete(localId);
    },
  },
  meal_templates: pushes(upsertMealTemplate, (db) => db.meal_templates),
  tasks: pushes(upsertTask, (db) => db.tasks),
  routines: pushes(upsertRoutine, (db) => db.routines),
  routine_completions: pushes(upsertRoutineCompletion, (db) => db.routine_completions),
  agent_memory: pushes(upsertAgentMemory, (db) => db.agent_memory),
  coco_conversations: pushes(upsertCocoConversation, (db) => db.coco_conversations),
  coco_messages: pushes(upsertCocoMessage, (db) => db.coco_messages),
  future_selves: pushes(upsertFutureSelf, (db) => db.future_selves),
  compasses: pushes(upsertCompass, (db) => db.compasses),
  inbox_items: pushes(upsertInboxItem, (db) => db.inbox_items),
  personal_rules: pushes(upsertPersonalRule, (db) => db.personal_rules),
} satisfies Record<SyncableTable, PushHandler>;

/** The tables a queued write can be pushed for; derived from the manifest. */
export const SYNC_PUSH_TABLES = Object.keys(PUSH_HANDLERS) as SyncableTable[];

export async function applySyncQueueItem(
  client: DbClient,
  item: SyncQueueItem,
  suppliedScope?: OfflineScope,
): Promise<void> {
  const scope = suppliedScope ?? getOfflineScope();
  const { db } = scope;
  const table = item.table;
  assertOfflineScope(scope);
  if (scope.userId !== item.userId) throw new StaleOfflineScopeError();
  const handler: PushHandler | undefined = PUSH_HANDLERS[table];
  if (!handler) throw new Error(`Unsupported sync push table: ${String(table)}`);
  const result = await handler.push(client, item.payload);
  assertOfflineScope(scope);
  if (!result.row) return;
  if (handler.reconcileId) await handler.reconcileId(db, item.entityId, result.row);
  await handler.store(db, result.row);
}

function syncSoon(): void {
  void syncNow();
}

async function bootstrapSync(): Promise<void> {
  const deps = state.deps;
  if (!deps) return;
  const { data } = await deps.getClient().auth.getSession();
  if (!data.session) {
    state.paused = true;
    await setOfflineUserScope(deps.guestId ?? null);
    await refreshPending();
    return;
  }
  await setOfflineUserScope(data.session.user.id);
  state.paused = false;
  await syncNow();
}

export function startSync(deps: SyncDeps): () => void {
  state.deps = deps;
  if (typeof window === 'undefined') {
    return () => {};
  }

  setOnlineFlag(navigator.onLine);
  const stopClosedDbRecovery = installClosedDbRecovery();
  void refreshPending();
  void bootstrapSync().catch(() => undefined);

  const onOnline = () => {
    setOnlineFlag(true);
    syncSoon();
  };
  const onOffline = () => setOnlineFlag(false);
  const onVisible = () => {
    // iOS: no Background Sync. Drain when the PWA becomes visible again.
    if (document.visibilityState === 'visible') syncSoon();
  };
  const onFocus = () => syncSoon();

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onFocus);

  const unsubAuth = deps.getClient().auth.onAuthStateChange((event, session) => {
    if (
      event === 'INITIAL_SESSION' ||
      event === 'SIGNED_IN' ||
      event === 'TOKEN_REFRESHED'
    ) {
      if (session) void setOfflineUserScope(session.user.id).catch(() => undefined);
      if (session) resumeSync();
    }
    if (event === 'SIGNED_OUT') {
      state.paused = true;
      void setOfflineUserScope(deps.guestId ?? null).catch(() => undefined);
      refreshSnapshot();
      notifySyncStatus();
    }
  });

  void refreshPending();

  return () => {
    stopClosedDbRecovery();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onFocus);
    unsubAuth.data.subscription.unsubscribe();
    if (state.timer) clearTimeout(state.timer);
    state.deps = null;
  };
}

export function bindStatusStore(onChange: () => void): () => void {
  return subscribeSyncStatus(onChange);
}

export function isSyncableTable(value: string): value is SyncableTable {
  return Object.prototype.hasOwnProperty.call(PUSH_HANDLERS, value);
}
