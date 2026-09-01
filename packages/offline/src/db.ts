import Dexie, { type Table } from 'dexie';
import type { CircleKind, GuidanceSnapshot, ShareFacet, StoryKind } from '@kayamo/core';
import type {
  AgentMemory,
  CocoConversation,
  CocoMessage,
  DailyLoopPreference,
  DailyPlan,
  Food,
  AchievementDefinitionRow,
  CompanionEvent,
  CompanionState,
  CosmeticDefinition,
  CosmeticUnlock,
  EvolutionStage,
  FutureSelf,
  GoalMilestone,
  Habit,
  HabitCompletion,
  InboxItem,
  Compass,
  PersonalRule,
  Exercise,
  FoodEntry,
  FocusSession,
  MealTemplate,
  Routine,
  RoutineCompletion,
  Serving,
  ScripturePassage,
  Task,
  UserAchievement,
  UserGoal,
  WeightLog,
  Workout,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutSet,
  BidirectionalSyncTable,
} from '@kayamo/db';

type LocalSyncRow<T> = Omit<T, 'server_seq'> & { server_seq?: number | null };

export type LocalFoodEntry = LocalSyncRow<FoodEntry>;
export type LocalWeightLog = LocalSyncRow<WeightLog>;
export type LocalWorkout = LocalSyncRow<Workout>;
export type LocalWorkoutSet = LocalSyncRow<WorkoutSet>;
export type LocalExercise = LocalSyncRow<Exercise>;
export type LocalWorkoutPlan = LocalSyncRow<WorkoutPlan>;
export type LocalWorkoutPlanExercise = LocalSyncRow<WorkoutPlanExercise>;
export type LocalFood = Food;
export type LocalServing = Serving;
export type LocalMealTemplate = LocalSyncRow<MealTemplate>;
export type LocalTask = LocalSyncRow<Task>;
export type LocalRoutine = LocalSyncRow<Routine>;
export type LocalRoutineCompletion = LocalSyncRow<RoutineCompletion>;
export type LocalAgentMemory = LocalSyncRow<AgentMemory>;
export type LocalCocoConversation = LocalSyncRow<CocoConversation>;
export type LocalCocoMessage = LocalSyncRow<CocoMessage>;
export type LocalDailyPlan = LocalSyncRow<DailyPlan>;
export type LocalFocusSession = LocalSyncRow<FocusSession>;
export type LocalDailyLoopPreference = LocalSyncRow<DailyLoopPreference>;
export type LocalScripturePassage = ScripturePassage;
export type LocalGoal = LocalSyncRow<UserGoal>;
export type LocalGoalMilestone = LocalSyncRow<GoalMilestone>;
export type LocalFutureSelf = LocalSyncRow<FutureSelf>;
export type LocalCompass = LocalSyncRow<Compass>;
export type LocalInboxItem = LocalSyncRow<InboxItem>;
export type LocalPersonalRule = LocalSyncRow<PersonalRule>;
export type LocalHabit = LocalSyncRow<Habit>;
export type LocalHabitCompletion = LocalSyncRow<HabitCompletion>;
export type LocalCompanionEvent = LocalSyncRow<CompanionEvent>;
export type LocalCompanionState = CompanionState;
export type LocalAchievementDefinition = AchievementDefinitionRow;
export type LocalUserAchievement = UserAchievement;
export type LocalEvolutionStage = EvolutionStage;
export type LocalCosmeticDefinition = CosmeticDefinition;
export type LocalCosmeticUnlock = CosmeticUnlock;

export type LocalJournalEntry = {
  id: string;
  user_id: string;
  kind: 'diary' | 'vent' | 'prayer' | 'reflection' | 'gratitude';
  content: string;
  created_at: string;
  updated_at: string;
};

export type LocalBusyBlock = {
  id: string;
  user_id: string;
  title: string;
  logical_date: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ScheduleFlexibility = 'FIXED' | 'FLEXIBLE' | 'AUTO' | 'ANYTIME' | 'PROTECTED';
export type ScheduleKind =
  | 'TASK'
  | 'EVENT'
  | 'ROUTINE'
  | 'GYM'
  | 'MEAL'
  | 'TRAVEL'
  | 'PROTECTED';
export type AiAccess = 'READ' | 'SUGGEST' | 'EDIT';
export type RecurrenceKind =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'after_completion';

export type LocalPlanningProject = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalTaskMeta = {
  task_id: string;
  user_id: string;
  flexibility: ScheduleFlexibility;
  estimated_duration_min: number;
  ai_access: AiAccess;
  locked: boolean;
  project_id: string | null;
  recurrence: RecurrenceKind;
  recurrence_interval_days: number;
  energy: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  focus: string | null;
  location: string | null;
  instance_of: string | null;
  occurrence_key: string | null;
  updated_at: string;
};

export type LocalTaskDependency = {
  id: string;
  user_id: string;
  task_id: string;
  blocks_task_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalTimeBlock = {
  id: string;
  user_id: string;
  logical_date: string;
  title: string;
  kind: ScheduleKind;
  start_min: number;
  end_min: number;
  flexibility: ScheduleFlexibility;
  locked: boolean;
  source_table: 'tasks' | 'workouts' | 'none';
  source_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalMusActionLog = {
  id: string;
  user_id: string;
  action: string;
  summary: string;
  inverse: Record<string, unknown>;
  created_at: string;
  undone_at: string | null;
};

export type LocalActionGrants = {
  user_id: string;
  levels: Record<string, string>;
  updated_at: string;
};

export type LocalLifeStoryEntry = {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  happened_on: string;
  kind: StoryKind;
  professional: boolean;
  source_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalGroveChapter = {
  id: string;
  user_id: string;
  closed_on: string;
  changed: string;
  accomplished: string;
  let_go: string;
  learned: string;
  carries: string;
  summary: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalCircle = {
  id: string;
  user_id: string;
  name: string;
  kind: CircleKind;
  facets: ShareFacet[];
  selected_goal_ids: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalSocialPrefs = {
  user_id: string;
  enabled: boolean;
  updated_at: string;
};

export type SyncableTable = BidirectionalSyncTable;

export type SyncQueueItem = {
  id: string;
  revision: string;
  userId: string;
  table: SyncableTable;
  entityId: string;
  payload: Record<string, unknown>;
  attempt: number;
  nextAttemptAt: number;
  lastError: string | null;
};

export type LegacyMigrationMarker = {
  id: string;
  source_database: string;
  user_id: string;
  completed_at: number;
};

export type SyncPullFailure = {
  id: string;
  user_id: string;
  table: SyncableTable;
  attempt: number;
  nextRetryAt: number;
  lastError: string;
  updatedAt: number;
};

export type OfflineScope = {
  userId: string | null;
  databaseName: string;
  db: KayaMoDB;
  epoch: number;
};

export class StaleOfflineScopeError extends Error {
  constructor() {
    super('Offline account scope changed during synchronization');
    this.name = 'StaleOfflineScopeError';
  }
}

export type SyncCheckpoint = {
  id: string;
  user_id: string;
  table: SyncableTable;
  cursor_version: 2;
  server_seq: number;
  updatedAt: number;
};

export type LegacySyncCheckpoint = {
  id: string;
  user_id: string;
  table: SyncableTable;
  cursor_version?: 1;
  server_updated_at: string;
  stable_key: string;
  updatedAt: number;
};

export type StoredSyncCheckpoint = SyncCheckpoint | LegacySyncCheckpoint;

export type LocalRestTimer = {
  workout_id: string;
  user_id: string;
  started_at: string;
  ends_at: string;
  performed_set_id?: string | null;
  duration_seconds?: number;
  status?: 'running' | 'expired' | 'dismissed';
};

export type GymSessionItemState =
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'SKIPPED'
  | 'SUBSTITUTED'
  | 'ADDED_LIVE';

export type LocalGymSessionItem = {
  id: string;
  user_id: string;
  session_id: string;
  slug: string;
  exercise_name: string;
  sequence_index: number;
  source: 'manual' | 'ai' | 'copy' | 'live';
  locked: boolean;
  state: GymSessionItemState;
  substituted_from_id: string | null;
  notes: string | null;
  discomfort: boolean;
  target_sets: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalGymPlannedSet = {
  id: string;
  user_id: string;
  item_id: string;
  set_index: number;
  set_type: 'warmup' | 'normal' | 'dropset';
  target_reps: number;
  target_weight_kg: number | null;
  target_rir: number | null;
  rest_seconds: number | null;
  performed_set_id: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalGymPrefs = {
  user_id: string;
  default_rest_seconds: number;
  favorite_slugs: string[];
  avoid_slugs: string[];
  updated_at: string;
};

export type LocalGymBusyEquipment = {
  id: string;
  user_id: string;
  logical_date: string;
  equipment_id: string;
  updated_at: string;
};

export type LocalGymSessionEvent = {
  id: string;
  user_id: string;
  session_id: string;
  event_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
};

export type LocalFoodCacheAccess = {
  id: string;
  accessed_at: number;
};

/**
 * Last known guidance from the server, kept so Health can still show a target
 * offline. A read cache only — it is never queued for sync.
 */
export type LocalGuidanceSnapshot = {
  user_id: string;
  snapshot: GuidanceSnapshot;
  cached_at: string;
};

export class KayaMoDB extends Dexie {
  food_entries!: Table<LocalFoodEntry, string>;
  weight_logs!: Table<LocalWeightLog, string>;
  workouts!: Table<LocalWorkout, string>;
  workout_sets!: Table<LocalWorkoutSet, string>;
  exercises!: Table<LocalExercise, string>;
  workout_plans!: Table<LocalWorkoutPlan, string>;
  workout_plan_exercises!: Table<LocalWorkoutPlanExercise, string>;
  rest_timers!: Table<LocalRestTimer, string>;
  gym_session_items!: Table<LocalGymSessionItem, string>;
  gym_planned_sets!: Table<LocalGymPlannedSet, string>;
  gym_session_events!: Table<LocalGymSessionEvent, string>;
  gym_prefs!: Table<LocalGymPrefs, string>;
  gym_busy_equipment!: Table<LocalGymBusyEquipment, string>;
  foods!: Table<LocalFood, string>;
  servings!: Table<LocalServing, string>;
  meal_templates!: Table<LocalMealTemplate, string>;
  tasks!: Table<LocalTask, string>;
  routines!: Table<LocalRoutine, string>;
  routine_completions!: Table<LocalRoutineCompletion, string>;
  agent_memory!: Table<LocalAgentMemory, string>;
  coco_conversations!: Table<LocalCocoConversation, string>;
  coco_messages!: Table<LocalCocoMessage, string>;
  goals!: Table<LocalGoal, string>;
  goal_milestones!: Table<LocalGoalMilestone, string>;
  future_selves!: Table<LocalFutureSelf, string>;
  compasses!: Table<LocalCompass, string>;
  inbox_items!: Table<LocalInboxItem, string>;
  personal_rules!: Table<LocalPersonalRule, string>;
  habits!: Table<LocalHabit, string>;
  habit_completions!: Table<LocalHabitCompletion, string>;
  companion_events!: Table<LocalCompanionEvent, string>;
  companion_state!: Table<LocalCompanionState, string>;
  achievement_definitions!: Table<LocalAchievementDefinition, string>;
  user_achievements!: Table<LocalUserAchievement, string>;
  evolution_stages!: Table<LocalEvolutionStage, string>;
  cosmetic_definitions!: Table<LocalCosmeticDefinition, string>;
  cosmetic_unlocks!: Table<LocalCosmeticUnlock, string>;
  daily_plans!: Table<LocalDailyPlan, string>;
  focus_sessions!: Table<LocalFocusSession, string>;
  daily_loop_preferences!: Table<LocalDailyLoopPreference, string>;
  scripture_passages!: Table<LocalScripturePassage, string>;
  local_journal_entries!: Table<LocalJournalEntry, string>;
  busy_blocks!: Table<LocalBusyBlock, string>;
  planning_projects!: Table<LocalPlanningProject, string>;
  task_meta!: Table<LocalTaskMeta, string>;
  task_dependencies!: Table<LocalTaskDependency, string>;
  time_blocks!: Table<LocalTimeBlock, string>;
  mus_action_log!: Table<LocalMusActionLog, string>;
  action_grants!: Table<LocalActionGrants, string>;
  life_story_entries!: Table<LocalLifeStoryEntry, string>;
  grove_chapters!: Table<LocalGroveChapter, string>;
  circles!: Table<LocalCircle, string>;
  social_prefs!: Table<LocalSocialPrefs, string>;
  guidance_snapshots!: Table<LocalGuidanceSnapshot, string>;
  food_cache_access!: Table<LocalFoodCacheAccess, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  sync_checkpoints!: Table<StoredSyncCheckpoint, string>;
  sync_pull_failures!: Table<SyncPullFailure, string>;
  migration_markers!: Table<LegacyMigrationMarker, string>;

  constructor(name = 'kayamo:signed-out') {
    super(name);
    this.version(1).stores({
      food_entries: 'id, user_id, logical_date, logged_at, updated_at, deleted_at',
      weight_logs: 'id, user_id, logical_date, measured_on, updated_at, deleted_at',
      workouts: 'id, user_id, logical_date, started_at, updated_at, deleted_at',
      workout_sets: 'id, workout_id, updated_at, deleted_at',
      foods: 'id, source, source_id, barcode, updated_at, deleted_at',
      servings: 'id, food_id',
      sync_queue: 'id, nextAttemptAt, table, entityId',
    });
    this.version(2).stores({
      meal_templates: 'id, user_id, updated_at, deleted_at',
    });
    this.version(3).stores({
      tasks: 'id, user_id, scheduled_for, due_at, completed_at, updated_at, deleted_at',
      routines: 'id, user_id, active, updated_at, deleted_at',
      routine_completions:
        'id, user_id, routine_id, logical_date, [routine_id+logical_date], updated_at, deleted_at',
    });
    this.version(4).stores({
      agent_memory: 'id, user_id, kind, updated_at, deleted_at',
      coco_conversations: 'id, user_id, updated_at, deleted_at',
      coco_messages: 'id, user_id, conversation_id, created_at, updated_at, deleted_at',
      local_journal_entries: 'id, user_id, kind, created_at, updated_at',
    });
    this.version(5).stores({
      workouts: 'id, user_id, status, logical_date, started_at, updated_at, deleted_at',
      workout_sets:
        'id, user_id, workout_id, exercise_id, [workout_id+exercise_id], updated_at, deleted_at',
      exercises: 'id, source, created_by, name, updated_at, deleted_at',
      workout_plans: 'id, user_id, active, updated_at, deleted_at',
      workout_plan_exercises:
        'id, user_id, plan_id, day_index, [plan_id+day_index], exercise_order, updated_at, deleted_at',
      rest_timers: 'workout_id, user_id, ends_at',
    });
    this.version(6).stores({
      goals: 'id, user_id, kind, status, target_date, updated_at, deleted_at',
      goal_milestones:
        'id, user_id, goal_id, sort_order, completed_at, updated_at, deleted_at',
      habits: 'id, user_id, goal_id, active, frequency, updated_at, deleted_at',
      habit_completions:
        'id, user_id, habit_id, logical_date, [habit_id+logical_date], updated_at, deleted_at',
      companion_events:
        'id, user_id, event_key, [user_id+event_key], event_type, logical_date, created_at',
      companion_state: 'user_id, stage_key, total_points, updated_at',
      achievement_definitions: 'id, key, metric, event_type, threshold',
      user_achievements: 'id, user_id, achievement_id, earned_at',
      evolution_stages: 'key, minimum_points, sort_order',
      cosmetic_definitions: 'id, key, required_stage_key, active',
      cosmetic_unlocks: 'id, user_id, cosmetic_id, unlocked_at',
    });
    this.version(7).stores({
      daily_plans:
        'id, user_id, logical_date, [user_id+logical_date], updated_at, deleted_at',
      focus_sessions:
        'id, user_id, logical_date, status, daily_plan_id, updated_at, deleted_at',
      daily_loop_preferences: 'user_id, updated_at, deleted_at',
      scripture_passages: 'id, key, reference, *tags, active',
    });
    this.version(8).stores({
      guidance_snapshots: 'user_id, cached_at',
    });
    this.version(9).stores({
      future_selves: 'user_id, updated_at, deleted_at',
      compasses: 'user_id, updated_at, deleted_at',
      inbox_items: 'id, user_id, processed_at, updated_at, deleted_at',
      personal_rules: 'id, user_id, active, updated_at, deleted_at',
    });
    this.version(10).stores({
      busy_blocks: 'id, user_id, logical_date, updated_at, deleted_at',
      action_grants: 'user_id, updated_at',
    });
    this.version(11).stores({
      life_story_entries: 'id, user_id, happened_on, updated_at, deleted_at',
      grove_chapters: 'id, user_id, closed_on, updated_at, deleted_at',
    });
    this.version(12).stores({
      circles: 'id, user_id, kind, updated_at, deleted_at',
      social_prefs: 'user_id, updated_at',
    });
    this.version(13).stores({
      food_cache_access: 'id, accessed_at',
    });
    this.version(14)
      .stores({
        sync_queue: 'id, userId, nextAttemptAt, table, entityId',
        sync_checkpoints: 'id, user_id, table, [user_id+table], updatedAt',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<SyncQueueItem, string>('sync_queue')
          .toCollection()
          .modify((item) => {
            if (!item.userId) {
              const owner = item.payload.user_id ?? item.payload.created_by;
              item.userId = typeof owner === 'string' ? owner : '';
            }
          });
      });
    this.version(15)
      .stores({
        sync_queue: 'id, userId, nextAttemptAt, table, entityId',
        sync_checkpoints: 'id, user_id, table, [user_id+table], updatedAt',
        sync_pull_failures: 'id, user_id, table, nextRetryAt, [user_id+table]',
        migration_markers: 'id, source_database, user_id, completed_at',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<SyncQueueItem, string>('sync_queue')
          .toCollection()
          .modify((item) => {
            if (!item.revision) item.revision = createMutationRevision();
          });
      });
    this.version(16).stores({
      sync_checkpoints: 'id, user_id, table, [user_id+table], updatedAt',
    });
    this.version(17).stores({
      planning_projects: 'id, user_id, updated_at, deleted_at',
      task_meta: 'task_id, user_id, project_id, updated_at',
      task_dependencies: 'id, user_id, task_id, blocks_task_id, updated_at, deleted_at',
      time_blocks: 'id, user_id, logical_date, updated_at, deleted_at',
      mus_action_log: 'id, user_id, created_at, undone_at',
    });
    this.version(18).stores({
      gym_session_items: 'id, user_id, session_id, updated_at, deleted_at',
      gym_planned_sets: 'id, user_id, item_id, updated_at, deleted_at',
      gym_session_events: 'id, user_id, session_id, created_at',
      gym_prefs: 'user_id, updated_at',
      gym_busy_equipment: 'id, user_id, logical_date',
    });
    this.version(19).stores({
      tasks:
        'id, user_id, scheduled_for, due_at, completed_at, updated_at, deleted_at, [user_id+scheduled_for]',
      task_meta: 'task_id, user_id, project_id, occurrence_key, updated_at',
      task_dependencies:
        'id, user_id, task_id, blocks_task_id, [user_id+blocks_task_id], updated_at, deleted_at',
      sync_queue: 'id, userId, nextAttemptAt, table, entityId, [userId+nextAttemptAt]',
    });
  }
}

let instance: KayaMoDB | undefined;
let instanceWasClosed = false;
let hasOpenedOnce = false;
let activeDatabaseName = 'kayamo:signed-out';
let activeUserId: string | null = null;
let activeEpoch = 0;
let activeScope: OfflineScope | undefined;
let scopeTransition: Promise<void> = Promise.resolve();
let activeInitialization: Promise<void> = Promise.resolve();
let revisionSequence = 0;

const USER_SCOPED_TABLES = [
  'food_entries',
  'weight_logs',
  'workouts',
  'workout_sets',
  'exercises',
  'workout_plans',
  'workout_plan_exercises',
  'rest_timers',
  'meal_templates',
  'tasks',
  'routines',
  'routine_completions',
  'agent_memory',
  'coco_conversations',
  'coco_messages',
  'goals',
  'goal_milestones',
  'future_selves',
  'compasses',
  'inbox_items',
  'personal_rules',
  'habits',
  'habit_completions',
  'companion_events',
  'companion_state',
  'user_achievements',
  'cosmetic_unlocks',
  'daily_plans',
  'focus_sessions',
  'daily_loop_preferences',
  'local_journal_entries',
  'busy_blocks',
  'planning_projects',
  'task_meta',
  'task_dependencies',
  'time_blocks',
  'mus_action_log',
  'action_grants',
  'life_story_entries',
  'grove_chapters',
  'circles',
  'social_prefs',
  'gym_session_items',
  'gym_planned_sets',
  'gym_session_events',
  'gym_prefs',
  'gym_busy_equipment',
  'guidance_snapshots',
  'sync_queue',
  'sync_checkpoints',
] as const;

const SHARED_CACHE_TABLES = [
  'scripture_passages',
  'achievement_definitions',
  'evolution_stages',
  'cosmetic_definitions',
] as const;

function accountDatabaseName(userId: string, namespace = 'default'): string {
  return `kayamo:${encodeURIComponent(namespace)}:user:${encodeURIComponent(userId)}`;
}

export function createMutationRevision(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  revisionSequence += 1;
  return `${Date.now().toString(36)}-${revisionSequence.toString(36)}`;
}

export function isDatabaseClosedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  const message = 'message' in error ? String(error.message) : '';
  return name === 'DatabaseClosedError' || message.includes('Database has been closed');
}

function connectionNeedsRevive(): boolean {
  return !instance || instanceWasClosed || (hasOpenedOnce && !instance.isOpen());
}

export async function recoverClosedOfflineDb<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isDatabaseClosedError(error)) throw error;
    reviveClosedOfflineDb();
    return await run();
  }
}

function bindActiveScope(db: KayaMoDB): void {
  activeScope = {
    userId: activeUserId,
    databaseName: activeDatabaseName,
    db,
    epoch: activeEpoch,
  };
}

function createOfflineDb(name: string, trackClose = false): KayaMoDB {
  const db = new KayaMoDB(name);
  if (trackClose) {
    db.on('ready', () => {
      hasOpenedOnce = true;
    });
    db.on('versionchange', () => {
      instanceWasClosed = true;
      db.close();
    });
  }
  return db;
}

export function reviveClosedOfflineDb(): KayaMoDB {
  if (instance && !instanceWasClosed && instance.isOpen()) return instance;
  instance?.close();
  instanceWasClosed = false;
  hasOpenedOnce = false;
  instance = createOfflineDb(activeDatabaseName, true);
  bindActiveScope(instance);
  return instance;
}

export function getOfflineDb(): KayaMoDB {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available');
  }
  const db = instance;
  if (!db || instanceWasClosed || (hasOpenedOnce && !db.isOpen())) {
    return reviveClosedOfflineDb();
  }
  return db;
}

export function getOfflineDbVersion(): number | null {
  try {
    return getOfflineDb().verno;
  } catch {
    return null;
  }
}

async function openNamedConnection(
  name: string,
): Promise<{ db: KayaMoDB; borrowed: boolean }> {
  if (instance?.name === name) {
    const db = getOfflineDb();
    if (!db.isOpen()) await db.open();
    return { db, borrowed: true };
  }
  const db = createOfflineDb(name);
  await db.open();
  return { db, borrowed: false };
}

export async function setOfflineUserScope(
  userId: string | null,
  options: { namespace?: string } = {},
): Promise<OfflineScope> {
  const nextName = userId
    ? accountDatabaseName(userId, options.namespace)
    : 'kayamo:signed-out';
  if (nextName === activeDatabaseName && activeUserId === userId && !connectionNeedsRevive()) {
    const scope = getOfflineScope();
    await activeInitialization;
    if (!userId) await evacuateSignedOutRows(scope.db);
    assertOfflineScope(scope);
    return scope;
  }

  const previousName = activeDatabaseName;
  instance?.close();
  instanceWasClosed = false;
  hasOpenedOnce = false;
  activeEpoch += 1;
  activeDatabaseName = nextName;
  activeUserId = userId;
  const db = createOfflineDb(nextName, true);
  instance = db;
  const scope: OfflineScope = {
    userId,
    databaseName: nextName,
    db,
    epoch: activeEpoch,
  };
  activeScope = scope;

  const transition = scopeTransition.then(() =>
    initializeOfflineScope(scope, previousName),
  );
  activeInitialization = transition;
  scopeTransition = transition.then(
    () => undefined,
    () => undefined,
  );
  await transition;
  assertOfflineScope(scope);
  return scope;
}

async function initializeOfflineScope(
  scope: OfflineScope,
  previousName: string,
): Promise<void> {
  const { db, userId } = scope;
  await db.open();
  if (!userId) {
    await evacuateSignedOutRows(db);
    return;
  }
  if (userId && previousName === 'kayamo:signed-out') {
    await copyAccountRows('kayamo:signed-out', db, userId, true);
  }
  if (userId && (await Dexie.exists('kayamo'))) {
    await migrateLegacyAccount('kayamo', db, userId);
  }
}

function rowOwner(row: Record<string, unknown>): string | null {
  const direct = row.user_id ?? row.created_by ?? row.userId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const payload = row.payload;
  if (typeof payload !== 'object' || payload === null) return null;
  const nested =
    (payload as Record<string, unknown>).user_id ??
    (payload as Record<string, unknown>).created_by;
  return typeof nested === 'string' && nested.length > 0 ? nested : null;
}

async function evacuateSignedOutRows(signedOut: KayaMoDB): Promise<void> {
  if (signedOut.name !== 'kayamo:signed-out') return;
  const owners = new Set<string>();
  for (const tableName of USER_SCOPED_TABLES) {
    const rows = await signedOut
      .table<Record<string, unknown>, string>(tableName)
      .toArray();
    for (const row of rows) {
      const owner = rowOwner(row);
      if (owner) owners.add(owner);
    }
  }
  for (const food of await signedOut.foods.toArray()) {
    if (food.created_by) owners.add(food.created_by);
  }

  for (const owner of owners) {
    const destination = createOfflineDb(accountDatabaseName(owner));
    await destination.open();
    try {
      await copyAccountRows('kayamo:signed-out', destination, owner, true);
    } finally {
      destination.close();
    }
  }
}

export function getOfflineScope(): OfflineScope {
  const db = getOfflineDb();
  if (!activeScope || activeScope.db !== db) {
    activeScope = {
      userId: activeUserId,
      databaseName: activeDatabaseName,
      db,
      epoch: activeEpoch,
    };
  }
  return activeScope;
}

export function assertOfflineScope(scope: OfflineScope): void {
  if (
    scope.epoch !== activeEpoch ||
    scope.db !== instance ||
    scope.databaseName !== activeDatabaseName ||
    scope.userId !== activeUserId
  ) {
    throw new StaleOfflineScopeError();
  }
}

export function getOfflineDatabaseName(): string {
  return activeDatabaseName;
}

function belongsToUser(row: Record<string, unknown>, userId: string): boolean {
  return rowOwner(row) === userId;
}

async function copyAccountRows(
  sourceName: string,
  destination: KayaMoDB,
  userId: string,
  removeFromSource: boolean,
  afterTable?: (table: string) => void | Promise<void>,
): Promise<void> {
  if (!(await Dexie.exists(sourceName)) || sourceName === destination.name) return;
  const { db: source, borrowed } = await openNamedConnection(sourceName);
  try {
    for (const tableName of USER_SCOPED_TABLES) {
      const sourceTable = source.table<Record<string, unknown>, string>(tableName);
      const rows = (await sourceTable.toArray()).filter((row) =>
        belongsToUser(row, userId),
      );
      if (rows.length === 0) continue;
      await destination.table<Record<string, unknown>, string>(tableName).bulkPut(rows);
      await afterTable?.(tableName);
      if (removeFromSource) {
        const keyPath = sourceTable.schema.primKey.keyPath;
        if (typeof keyPath === 'string') {
          const keys = rows
            .map((row) => row[keyPath])
            .filter((key): key is string => typeof key === 'string');
          await sourceTable.bulkDelete(keys);
        }
      }
    }
    const userFoods = (await source.foods.toArray()).filter(
      (row) => row.created_by === userId,
    );
    if (userFoods.length > 0) {
      const foodIds = new Set(userFoods.map((row) => row.id));
      const servings = (await source.servings.toArray()).filter((row) =>
        foodIds.has(row.food_id),
      );
      const accessRows = (await source.food_cache_access.toArray()).filter((row) =>
        foodIds.has(row.id),
      );
      await destination.foods.bulkPut(userFoods);
      if (servings.length > 0) await destination.servings.bulkPut(servings);
      if (accessRows.length > 0) await destination.food_cache_access.bulkPut(accessRows);
      await afterTable?.('foods');
      if (removeFromSource) {
        await source.foods.bulkDelete([...foodIds]);
        await source.servings.bulkDelete(servings.map((row) => row.id));
        await source.food_cache_access.bulkDelete(accessRows.map((row) => row.id));
      }
    }
  } finally {
    if (!borrowed) source.close();
  }
}

function legacyMigrationMarkerId(sourceName: string, userId: string): string {
  return `${sourceName}:${userId}`;
}

export async function migrateLegacyAccount(
  sourceName: string,
  destination: KayaMoDB,
  userId: string,
  options: { afterTable?: (table: string) => void | Promise<void> } = {},
): Promise<boolean> {
  const markerId = legacyMigrationMarkerId(sourceName, userId);
  if (await destination.migration_markers.get(markerId)) return false;
  if (!(await Dexie.exists(sourceName)) || sourceName === destination.name) return false;

  await copyAccountRows(sourceName, destination, userId, false, options.afterTable);
  await copySharedCacheRows(sourceName, destination, userId);
  await destination.migration_markers.put({
    id: markerId,
    source_database: sourceName,
    user_id: userId,
    completed_at: Date.now(),
  });
  return true;
}

async function copySharedCacheRows(
  sourceName: string,
  destination: KayaMoDB,
  userId: string,
): Promise<void> {
  const { db: source, borrowed } = await openNamedConnection(sourceName);
  try {
    const foods = await source.foods.toArray();
    const allowedFoods = foods.filter(
      (row) => row.created_by === null || row.created_by === userId,
    );
    const allowedFoodIds = new Set(allowedFoods.map((row) => row.id));
    if (allowedFoods.length > 0) await destination.foods.bulkPut(allowedFoods);
    const servings = (await source.servings.toArray()).filter((row) =>
      allowedFoodIds.has(row.food_id),
    );
    if (servings.length > 0) await destination.servings.bulkPut(servings);
    const accessRows = (await source.food_cache_access.toArray()).filter((row) =>
      allowedFoodIds.has(row.id),
    );
    if (accessRows.length > 0) await destination.food_cache_access.bulkPut(accessRows);

    for (const tableName of SHARED_CACHE_TABLES) {
      const rows = await source
        .table<Record<string, unknown>, string>(tableName)
        .toArray();
      if (rows.length > 0) {
        await destination.table<Record<string, unknown>, string>(tableName).bulkPut(rows);
      }
    }
  } finally {
    if (!borrowed) source.close();
  }
}

export async function resetOfflineDb(): Promise<void> {
  await scopeTransition;
  instance?.close();
  instance = undefined;
  instanceWasClosed = false;
  hasOpenedOnce = false;
  activeScope = undefined;
  activeEpoch += 1;
  if (typeof indexedDB !== 'undefined') {
    const names = await Dexie.getDatabaseNames();
    await Promise.all(
      names
        .filter((name) => name === 'kayamo' || name.startsWith('kayamo:'))
        .map((name) => Dexie.delete(name)),
    );
  }
  activeDatabaseName = 'kayamo:signed-out';
  activeUserId = null;
}

export function queueItemId(
  table: SyncableTable,
  entityId: string,
  userId?: string,
): string {
  return userId ? `${userId}:${table}:${entityId}` : `${table}:${entityId}`;
}

export function checkpointId(userId: string, table: SyncableTable): string {
  return `${userId}:${table}`;
}
