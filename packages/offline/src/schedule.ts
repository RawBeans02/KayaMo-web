import { addLogicalCalendarDays } from './logical-date';
import {
  getOfflineDb,
  type AiAccess,
  type LocalMusActionLog,
  type LocalPlanningProject,
  type LocalTask,
  type LocalTaskDependency,
  type LocalTaskMeta,
  type LocalTimeBlock,
  type RecurrenceKind,
  type ScheduleFlexibility,
  type ScheduleKind,
} from './db';
import { createLocalTask, listLocalTasks, setLocalTaskCompleted, setLocalTaskScheduledFor } from './planning';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export const DEFAULT_TASK_META: Omit<LocalTaskMeta, 'task_id' | 'user_id' | 'updated_at'> = {
  flexibility: 'FLEXIBLE',
  estimated_duration_min: 30,
  ai_access: 'EDIT',
  locked: false,
  project_id: null,
  recurrence: 'none',
  recurrence_interval_days: 1,
  energy: null,
  focus: null,
  location: null,
  instance_of: null,
};

export async function createLocalProject(input: {
  userId: string;
  title: string;
  notes?: string | null;
  id?: string;
}): Promise<LocalPlanningProject> {
  const at = nowIso();
  const row: LocalPlanningProject = {
    id: input.id ?? newId(),
    user_id: input.userId,
    title: input.title.trim().slice(0, 160),
    notes: input.notes ?? null,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().planning_projects.put(row);
  return row;
}

export async function listLocalProjects(userId: string): Promise<LocalPlanningProject[]> {
  return (await getOfflineDb().planning_projects.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function tombstoneLocalProject(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.planning_projects.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  await db.planning_projects.put({ ...existing, deleted_at: at, updated_at: at });
}

export async function getLocalTaskMeta(taskId: string): Promise<LocalTaskMeta | null> {
  return (await getOfflineDb().task_meta.get(taskId)) ?? null;
}

export async function upsertLocalTaskMeta(
  input: Partial<LocalTaskMeta> & { taskId: string; userId: string },
): Promise<LocalTaskMeta> {
  const existing = await getLocalTaskMeta(input.taskId);
  const row: LocalTaskMeta = {
    ...DEFAULT_TASK_META,
    ...existing,
    task_id: input.taskId,
    user_id: input.userId,
    flexibility: input.flexibility ?? existing?.flexibility ?? DEFAULT_TASK_META.flexibility,
    estimated_duration_min:
      input.estimated_duration_min ??
      existing?.estimated_duration_min ??
      DEFAULT_TASK_META.estimated_duration_min,
    ai_access: (input.ai_access ?? existing?.ai_access ?? DEFAULT_TASK_META.ai_access) as AiAccess,
    locked: input.locked ?? existing?.locked ?? false,
    project_id: input.project_id === undefined ? (existing?.project_id ?? null) : input.project_id,
    recurrence: (input.recurrence ?? existing?.recurrence ?? 'none') as RecurrenceKind,
    recurrence_interval_days:
      input.recurrence_interval_days ?? existing?.recurrence_interval_days ?? 1,
    energy: input.energy === undefined ? (existing?.energy ?? null) : input.energy,
    focus: input.focus === undefined ? (existing?.focus ?? null) : input.focus,
    location: input.location === undefined ? (existing?.location ?? null) : input.location,
    instance_of: input.instance_of === undefined ? (existing?.instance_of ?? null) : input.instance_of,
    updated_at: nowIso(),
  };
  await getOfflineDb().task_meta.put(row);
  return row;
}

export async function addLocalDependency(input: {
  userId: string;
  taskId: string;
  blocksTaskId: string;
}): Promise<LocalTaskDependency> {
  const at = nowIso();
  const row: LocalTaskDependency = {
    id: newId(),
    user_id: input.userId,
    task_id: input.taskId,
    blocks_task_id: input.blocksTaskId,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().task_dependencies.put(row);
  return row;
}

export async function listBlockersForTask(
  userId: string,
  taskId: string,
): Promise<LocalTaskDependency[]> {
  return (await getOfflineDb().task_dependencies.where('user_id').equals(userId).toArray()).filter(
    (row) => !row.deleted_at && row.blocks_task_id === taskId,
  );
}

export async function createLocalTimeBlock(input: {
  userId: string;
  logicalDate: string;
  title: string;
  kind?: ScheduleKind;
  startMin: number;
  endMin: number;
  flexibility?: ScheduleFlexibility;
  locked?: boolean;
  sourceTable?: LocalTimeBlock['source_table'];
  sourceId?: string | null;
  notes?: string | null;
  id?: string;
}): Promise<LocalTimeBlock> {
  const start = Math.max(0, Math.min(input.startMin, 24 * 60 - 5));
  const end = Math.max(start + 5, Math.min(input.endMin, 24 * 60));
  const at = nowIso();
  const row: LocalTimeBlock = {
    id: input.id ?? newId(),
    user_id: input.userId,
    logical_date: input.logicalDate,
    title: input.title.trim().slice(0, 160),
    kind: input.kind ?? 'TASK',
    start_min: start,
    end_min: end,
    flexibility: input.flexibility ?? 'FLEXIBLE',
    locked: input.locked ?? false,
    source_table: input.sourceTable ?? 'none',
    source_id: input.sourceId ?? null,
    notes: input.notes ?? null,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().time_blocks.put(row);
  return row;
}

export async function listLocalTimeBlocks(
  userId: string,
  logicalDate: string,
): Promise<LocalTimeBlock[]> {
  return (await getOfflineDb().time_blocks.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at && row.logical_date === logicalDate)
    .sort((a, b) => a.start_min - b.start_min || a.created_at.localeCompare(b.created_at));
}

export async function getLocalTimeBlock(id: string, userId: string): Promise<LocalTimeBlock | null> {
  const row = await getOfflineDb().time_blocks.get(id);
  if (!row || row.user_id !== userId || row.deleted_at) return null;
  return row;
}

export async function listLocalTimeBlocksRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<LocalTimeBlock[]> {
  return (await getOfflineDb().time_blocks.where('user_id').equals(userId).toArray())
    .filter(
      (row) => !row.deleted_at && row.logical_date >= startDate && row.logical_date <= endDate,
    )
    .sort(
      (a, b) =>
        a.logical_date.localeCompare(b.logical_date) || a.start_min - b.start_min,
    );
}

export async function updateLocalTimeBlock(
  input: Partial<Pick<LocalTimeBlock, 'title' | 'start_min' | 'end_min' | 'flexibility' | 'locked' | 'notes' | 'kind'>> & {
    id: string;
    userId: string;
  },
): Promise<LocalTimeBlock | null> {
  const db = getOfflineDb();
  const existing = await db.time_blocks.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  if (existing.locked && existing.flexibility === 'FIXED' && (input.start_min !== undefined || input.end_min !== undefined)) {
    if (input.locked !== false) {
      // Manual edits still allowed; AI auto-move is blocked in the action router.
    }
  }
  const start = input.start_min ?? existing.start_min;
  const end = input.end_min ?? existing.end_min;
  const row: LocalTimeBlock = {
    ...existing,
    title: input.title?.trim() || existing.title,
    start_min: start,
    end_min: Math.max(start + 5, end),
    flexibility: input.flexibility ?? existing.flexibility,
    locked: input.locked ?? existing.locked,
    notes: input.notes === undefined ? existing.notes : input.notes,
    kind: input.kind ?? existing.kind,
    updated_at: nowIso(),
  };
  await db.time_blocks.put(row);
  return row;
}

export async function tombstoneLocalTimeBlock(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.time_blocks.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  await db.time_blocks.put({ ...existing, deleted_at: at, updated_at: at });
}

export async function recordMusAction(input: {
  userId: string;
  action: string;
  summary: string;
  inverse: Record<string, unknown>;
}): Promise<LocalMusActionLog> {
  const row: LocalMusActionLog = {
    id: newId(),
    user_id: input.userId,
    action: input.action,
    summary: input.summary,
    inverse: input.inverse,
    created_at: nowIso(),
    undone_at: null,
  };
  await getOfflineDb().mus_action_log.put(row);
  return row;
}

export async function listMusActionLog(userId: string, limit = 20): Promise<LocalMusActionLog[]> {
  return (await getOfflineDb().mus_action_log.where('user_id').equals(userId).toArray())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function undoLatestMusAction(userId: string): Promise<string | null> {
  const latest = (await listMusActionLog(userId, 8)).find((row) => !row.undone_at);
  if (!latest) return null;
  const inverse = latest.inverse;
  const db = getOfflineDb();
  if (inverse.kind === 'restore_block' && typeof inverse.id === 'string') {
    const block = await db.time_blocks.get(inverse.id);
    if (block && block.user_id === userId) {
      await db.time_blocks.put({
        ...block,
        start_min: Number(inverse.start_min ?? block.start_min),
        end_min: Number(inverse.end_min ?? block.end_min),
        deleted_at: inverse.deleted_at === true ? nowIso() : null,
        updated_at: nowIso(),
      });
    }
  }
  if (inverse.kind === 'restore_task_schedule' && typeof inverse.taskId === 'string') {
    const task = await db.tasks.get(inverse.taskId);
    if (task && task.user_id === userId && !task.deleted_at) {
      await db.tasks.put({
        ...task,
        scheduled_for: (inverse.scheduled_for as string | null) ?? null,
        updated_at: nowIso(),
      });
    }
  }
  if (inverse.kind === 'uncomplete_task' && typeof inverse.taskId === 'string') {
    await setLocalTaskCompleted({ id: inverse.taskId, userId, completed: false });
  }
  if (inverse.kind === 'undo_plan') {
    const blockIds = Array.isArray(inverse.blockIds) ? inverse.blockIds : [];
    for (const id of blockIds) {
      if (typeof id === 'string') await tombstoneLocalTimeBlock({ id, userId });
    }
    const rows = Array.isArray(inverse.tasks) ? inverse.tasks : [];
    for (const row of rows) {
      if (!row || typeof row !== 'object' || !('taskId' in row)) continue;
      const taskId = (row as { taskId: unknown }).taskId;
      if (typeof taskId !== 'string') continue;
      const scheduled =
        'scheduled_for' in row ? ((row as { scheduled_for: unknown }).scheduled_for as string | null) : null;
      await setLocalTaskScheduledFor({
        id: taskId,
        userId,
        scheduledFor: scheduled ?? null,
      });
    }
  }
  await db.mus_action_log.put({ ...latest, undone_at: nowIso() });
  return latest.summary;
}

function weekdayUtc(logicalDate: string): number {
  const [year, month, day] = logicalDate.split('-').map(Number);
  return new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

export function nextRecurrenceDate(from: string, recurrence: RecurrenceKind, interval: number): string {
  if (recurrence === 'daily' || recurrence === 'after_completion') {
    return addLogicalCalendarDays(from, Math.max(1, interval));
  }
  if (recurrence === 'weekly') return addLogicalCalendarDays(from, 7 * Math.max(1, interval));
  if (recurrence === 'monthly') return addLogicalCalendarDays(from, 30 * Math.max(1, interval));
  if (recurrence === 'weekdays') {
    let next = addLogicalCalendarDays(from, 1);
    while (weekdayUtc(next) === 0 || weekdayUtc(next) === 6) {
      next = addLogicalCalendarDays(next, 1);
    }
    return next;
  }
  return addLogicalCalendarDays(from, 1);
}

export async function spawnRecurrenceIfNeeded(params: {
  userId: string;
  task: LocalTask;
  today: string;
}): Promise<LocalTask | null> {
  const meta = await getLocalTaskMeta(params.task.id);
  if (!meta || meta.recurrence === 'none') return null;
  const nextDate = nextRecurrenceDate(
    params.task.scheduled_for ?? params.today,
    meta.recurrence,
    meta.recurrence_interval_days,
  );
  const clone = await createLocalTask({
    userId: params.userId,
    title: params.task.title,
    notes: params.task.notes,
    scheduledFor: nextDate,
    origin: params.task.origin,
  });
  await upsertLocalTaskMeta({
    taskId: clone.id,
    userId: params.userId,
    flexibility: meta.flexibility,
    estimated_duration_min: meta.estimated_duration_min,
    ai_access: meta.ai_access,
    locked: meta.locked,
    project_id: meta.project_id,
    recurrence: meta.recurrence,
    instance_of: meta.instance_of ?? params.task.id,
    energy: meta.energy,
    focus: meta.focus,
    location: meta.location,
  });
  return clone;
}

export async function taskIsBlocked(userId: string, taskId: string): Promise<boolean> {
  const blockers = await listBlockersForTask(userId, taskId);
  if (blockers.length === 0) return false;
  const tasks = await listLocalTasks(userId);
  const byId = new Map(tasks.map((row) => [row.id, row]));
  return blockers.some((row) => {
    const prereq = byId.get(row.task_id);
    return prereq && !prereq.completed_at;
  });
}
