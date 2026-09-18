import { omitServerCursor, parseTaskTitle } from '@kayamo/db';
import {
  assertOfflineScope,
  createMutationRevision,
  getOfflineScope,
  queueItemId,
  type LocalGoal,
  type LocalGoalMilestone,
  type LocalTask,
  type SyncQueueItem,
} from './db';
import { notifySyncStatus } from './status';
import { drainQueue } from './sync';

export type CreateGoalPlanInput = {
  /** Stable confirmation id, retained with the editor draft for safe retries. */
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  lifeArea?: LocalGoal['life_area'];
  targetDate?: string | null;
  firstStep?: string;
  doneLooks?: string;
  logicalDate: string;
};

/** Goal, milestones, daily task and their outbox entries commit or roll back together.
 * Remote sync stays eventually consistent; no new server transaction is implied.
 */
export async function createLocalGoalPlan(
  input: CreateGoalPlanInput,
): Promise<LocalGoal> {
  const scope = getOfflineScope();
  if (scope.userId !== input.userId)
    throw new Error('Goal owner is not the active account');
  const db = scope.db;
  const title = input.title.trim();
  if (!title || !input.id) throw new Error('Goal title and confirmation id are required');
  const stepTitle = input.firstStep?.trim() ? parseTaskTitle(input.firstStep) : '';
  const doneTitle = input.doneLooks?.trim() ?? '';
  const at = new Date().toISOString();
  const goal: LocalGoal = {
    id: input.id,
    user_id: input.userId,
    title,
    description: input.description ?? null,
    kind: 'goal',
    status: 'active',
    starts_on: null,
    target_date: input.targetDate ?? null,
    completed_at: null,
    origin: 'user',
    life_area: input.lifeArea ?? null,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  const milestones: LocalGoalMilestone[] = [stepTitle, doneTitle]
    .filter(Boolean)
    .map((label, index) => ({
      id: crypto.randomUUID(),
      user_id: input.userId,
      goal_id: goal.id,
      title: label,
      sort_order: index,
      target_date: null,
      completed_at: null,
      created_at: at,
      updated_at: at,
      server_updated_at: at,
      deleted_at: null,
    }));
  const task: LocalTask | null = stepTitle
    ? {
        id: crypto.randomUUID(),
        user_id: input.userId,
        title: stepTitle,
        notes: null,
        scheduled_for: input.logicalDate,
        due_at: null,
        completed_at: null,
        sort_order: 0,
        origin: 'user',
        created_at: at,
        updated_at: at,
        server_updated_at: at,
        deleted_at: null,
      }
    : null;
  const queue: SyncQueueItem[] = [];
  function enqueue(
    table: SyncQueueItem['table'],
    row: LocalGoal | LocalGoalMilestone | LocalTask,
  ) {
    queue.push({
      id: queueItemId(table, row.id, input.userId),
      revision: createMutationRevision(),
      userId: input.userId,
      table,
      entityId: row.id,
      payload: omitServerCursor(row),
      attempt: 0,
      nextAttemptAt: Date.now(),
      lastError: null,
    });
  }
  enqueue('goals', goal);
  for (const milestone of milestones) enqueue('goal_milestones', milestone);
  if (task) enqueue('tasks', task);
  const saved = await db.transaction(
    'rw',
    [db.goals, db.goal_milestones, db.tasks, db.sync_queue],
    async () => {
      assertOfflineScope(scope);
      const existing = await db.goals.get(input.id);
      if (existing) {
        if (existing.user_id !== input.userId || existing.deleted_at)
          throw new Error('Goal confirmation is unavailable');
        return existing;
      }
      await db.goals.add(goal);
      if (milestones.length) await db.goal_milestones.bulkAdd(milestones);
      if (task) await db.tasks.add(task);
      await db.sync_queue.bulkAdd(queue);
      assertOfflineScope(scope);
      return goal;
    },
  );
  notifySyncStatus();
  // A transient network/scope failure must not become an unhandled rejection
  // after the durable local save. The existing outbox owns retry/recovery.
  void drainQueue().catch(() => undefined);
  return saved;
}
