import type {
  AgentMemoryWrite,
  CocoConversationWrite,
  CocoMessageWrite,
  CompanionEventWrite,
  DailyLoopPreferenceWrite,
  DailyPlanWrite,
  DbClient,
  FoodEntryWrite,
  FocusSessionWrite,
  GoalMilestoneWrite,
  GoalWrite,
  HabitCompletionWrite,
  HabitWrite,
  InboxItemWrite,
  CompassWrite,
  FutureSelfWrite,
  MealTemplateWrite,
  RoutineCompletionWrite,
  PersonalRuleWrite,
  RoutineWrite,
  TaskWrite,
  UserExerciseWrite,
  UpsertMealTemplateResult,
  UpsertResult,
  WeightLogWrite,
  WorkoutSetWrite,
  WorkoutPlanExerciseWrite,
  WorkoutPlanWrite,
  WorkoutWrite,
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
  setOfflineUserScope,
  StaleOfflineScopeError,
  type OfflineScope,
  type SyncQueueItem,
  type SyncableTable,
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
  switch (table) {
    case 'food_entries': {
      const result: UpsertResult = await upsertFoodEntry(
        client,
        item.payload as FoodEntryWrite,
      );
      assertOfflineScope(scope);
      if (result.row) {
        await db.food_entries.put(result.row);
      }
      return;
    }
    case 'daily_plans': {
      const result = await upsertDailyPlan(client, item.payload as DailyPlanWrite);
      assertOfflineScope(scope);
      if (result.row) await db.daily_plans.put(result.row);
      return;
    }
    case 'focus_sessions': {
      const result = await upsertFocusSession(client, item.payload as FocusSessionWrite);
      assertOfflineScope(scope);
      if (result.row) await db.focus_sessions.put(result.row);
      return;
    }
    case 'daily_loop_preferences': {
      const result = await upsertDailyLoopPreferences(
        client,
        item.payload as DailyLoopPreferenceWrite,
      );
      assertOfflineScope(scope);
      if (result.row) await db.daily_loop_preferences.put(result.row);
      return;
    }
    case 'weight_logs': {
      const result = await upsertWeightLog(client, item.payload as WeightLogWrite);
      assertOfflineScope(scope);
      if (result.row) await db.weight_logs.put(result.row);
      return;
    }
    case 'workouts': {
      const result = await upsertWorkout(client, item.payload as WorkoutWrite);
      assertOfflineScope(scope);
      if (result.row) await db.workouts.put(result.row);
      return;
    }
    case 'workout_sets': {
      const result = await upsertWorkoutSet(client, item.payload as WorkoutSetWrite);
      assertOfflineScope(scope);
      if (result.row) await db.workout_sets.put(result.row);
      return;
    }
    case 'exercises': {
      const result = await upsertUserExercise(client, item.payload as UserExerciseWrite);
      assertOfflineScope(scope);
      if (result.row) await db.exercises.put(result.row);
      return;
    }
    case 'workout_plans': {
      const result = await upsertWorkoutPlan(client, item.payload as WorkoutPlanWrite);
      assertOfflineScope(scope);
      if (result.row) await db.workout_plans.put(result.row);
      return;
    }
    case 'workout_plan_exercises': {
      const result = await upsertWorkoutPlanExercise(
        client,
        item.payload as WorkoutPlanExerciseWrite,
      );
      assertOfflineScope(scope);
      if (result.row) await db.workout_plan_exercises.put(result.row);
      return;
    }
    case 'goals': {
      const result = await upsertGoal(client, item.payload as GoalWrite);
      assertOfflineScope(scope);
      if (result.row) await db.goals.put(result.row);
      return;
    }
    case 'goal_milestones': {
      const result = await upsertGoalMilestone(
        client,
        item.payload as GoalMilestoneWrite,
      );
      assertOfflineScope(scope);
      if (result.row) await db.goal_milestones.put(result.row);
      return;
    }
    case 'habits': {
      const result = await upsertHabit(client, item.payload as HabitWrite);
      assertOfflineScope(scope);
      if (result.row) await db.habits.put(result.row);
      return;
    }
    case 'habit_completions': {
      const result = await upsertHabitCompletion(
        client,
        item.payload as HabitCompletionWrite,
      );
      assertOfflineScope(scope);
      if (result.row) await db.habit_completions.put(result.row);
      return;
    }
    case 'companion_events': {
      const result = await recordCompanionEvent(
        client,
        item.payload as CompanionEventWrite,
      );
      assertOfflineScope(scope);
      if (result.row.id !== item.entityId) {
        await db.companion_events.delete(item.entityId);
      }
      await db.companion_events.put(result.row);
      return;
    }
    case 'meal_templates': {
      const result: UpsertMealTemplateResult = await upsertMealTemplate(
        client,
        item.payload as MealTemplateWrite,
      );
      assertOfflineScope(scope);
      if (result.row) {
        await db.meal_templates.put(result.row);
      }
      return;
    }
    case 'tasks': {
      const result = await upsertTask(client, item.payload as TaskWrite);
      assertOfflineScope(scope);
      if (result.row) await db.tasks.put(result.row);
      return;
    }
    case 'routines': {
      const result = await upsertRoutine(client, item.payload as RoutineWrite);
      assertOfflineScope(scope);
      if (result.row) await db.routines.put(result.row);
      return;
    }
    case 'routine_completions': {
      const result = await upsertRoutineCompletion(
        client,
        item.payload as RoutineCompletionWrite,
      );
      assertOfflineScope(scope);
      if (result.row) await db.routine_completions.put(result.row);
      return;
    }
    case 'agent_memory': {
      const result = await upsertAgentMemory(client, item.payload as AgentMemoryWrite);
      assertOfflineScope(scope);
      if (result.row) await db.agent_memory.put(result.row);
      return;
    }
    case 'coco_conversations': {
      const result = await upsertCocoConversation(
        client,
        item.payload as CocoConversationWrite,
      );
      assertOfflineScope(scope);
      if (result.row) await db.coco_conversations.put(result.row);
      return;
    }
    case 'coco_messages': {
      const result = await upsertCocoMessage(client, item.payload as CocoMessageWrite);
      assertOfflineScope(scope);
      if (result.row) await db.coco_messages.put(result.row);
      return;
    }
    case 'future_selves': {
      const result = await upsertFutureSelf(client, item.payload as FutureSelfWrite);
      assertOfflineScope(scope);
      if (result.row) await db.future_selves.put(result.row);
      return;
    }
    case 'compasses': {
      const result = await upsertCompass(client, item.payload as CompassWrite);
      assertOfflineScope(scope);
      if (result.row) await db.compasses.put(result.row);
      return;
    }
    case 'inbox_items': {
      const result = await upsertInboxItem(client, item.payload as InboxItemWrite);
      assertOfflineScope(scope);
      if (result.row) await db.inbox_items.put(result.row);
      return;
    }
    case 'personal_rules': {
      const result = await upsertPersonalRule(client, item.payload as PersonalRuleWrite);
      assertOfflineScope(scope);
      if (result.row) await db.personal_rules.put(result.row);
      return;
    }
    default:
      return unsupportedSyncTable(table);
  }
}

function unsupportedSyncTable(table: never): never {
  throw new Error(`Unsupported sync push table: ${String(table)}`);
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
    await setOfflineUserScope(null);
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
  void refreshPending();
  void bootstrapSync();

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
      void setOfflineUserScope(null).catch(() => undefined);
      refreshSnapshot();
      notifySyncStatus();
    }
  });

  void refreshPending();

  return () => {
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
  return (
    value === 'food_entries' ||
    value === 'daily_plans' ||
    value === 'focus_sessions' ||
    value === 'daily_loop_preferences' ||
    value === 'weight_logs' ||
    value === 'workouts' ||
    value === 'workout_sets' ||
    value === 'exercises' ||
    value === 'workout_plans' ||
    value === 'workout_plan_exercises' ||
    value === 'goals' ||
    value === 'goal_milestones' ||
    value === 'habits' ||
    value === 'habit_completions' ||
    value === 'companion_events' ||
    value === 'meal_templates' ||
    value === 'tasks' ||
    value === 'routines' ||
    value === 'routine_completions' ||
    value === 'agent_memory' ||
    value === 'coco_conversations' ||
    value === 'coco_messages' ||
    value === 'future_selves' ||
    value === 'compasses' ||
    value === 'inbox_items' ||
    value === 'personal_rules'
  );
}
