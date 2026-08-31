import type { RoutineCompletionWrite, RoutineWrite, TaskWrite } from '@kayamo/db';
import { incomingWins, omitServerCursor } from '@kayamo/db';
import {
  getOfflineDb,
  type LocalRoutine,
  type LocalRoutineCompletion,
  type LocalTask,
} from './db';
import { enqueueUpsert } from './queue';
import { drainQueue } from './sync';
import { createLocalCompanionEvent } from './journey';
import { logicalDateFromInstant } from './logical-date';

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function taskPayload(row: LocalTask): TaskWrite {
  return omitServerCursor(row);
}

function routinePayload(row: LocalRoutine): RoutineWrite {
  return omitServerCursor(row);
}

function routineCompletionPayload(row: LocalRoutineCompletion): RoutineCompletionWrite {
  return omitServerCursor(row);
}

export async function createLocalTask(input: {
  userId: string;
  title: string;
  notes?: string | null;
  scheduledFor?: string | null;
  dueAt?: string | null;
  sortOrder?: number;
  origin?: LocalTask['origin'];
  id?: string;
}): Promise<LocalTask> {
  const at = nowIso();
  const row: LocalTask = {
    id: input.id ?? newId(),
    user_id: input.userId,
    title: input.title.trim(),
    notes: input.notes ?? null,
    scheduled_for: input.scheduledFor ?? null,
    due_at: input.dueAt ?? null,
    completed_at: null,
    sort_order: input.sortOrder ?? 0,
    origin: input.origin ?? 'user',
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().tasks.put(row);
  await enqueueUpsert('tasks', row.id, taskPayload(row));
  void drainQueue();
  return row;
}

export async function setLocalTaskCompleted(params: {
  id: string;
  userId: string;
  completed: boolean;
  timeZone?: string;
  dayStartsAt?: string;
}): Promise<LocalTask | null> {
  const db = getOfflineDb();
  const existing = await db.tasks.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return null;
  const at = nowIso();
  const row: LocalTask = {
    ...existing,
    completed_at: params.completed ? at : null,
    updated_at: at,
  };
  await db.tasks.put(row);
  await enqueueUpsert('tasks', row.id, taskPayload(row));
  if (params.completed) {
    await createLocalCompanionEvent({
      userId: params.userId,
      eventType: 'task_completed',
      sourceTable: 'tasks',
      sourceId: row.id,
      logicalDate:
        row.scheduled_for ??
        logicalDateFromInstant(at, params.timeZone, params.dayStartsAt),
    });
  }
  void drainQueue();
  return row;
}

export async function updateLocalTask(params: {
  id: string;
  userId: string;
  title?: string;
  notes?: string | null;
}): Promise<LocalTask | null> {
  const db = getOfflineDb();
  const existing = await db.tasks.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return null;
  const title =
    params.title === undefined ? existing.title : params.title.trim();
  if (title.length < 1 || title.length > 160) return existing;
  const at = nowIso();
  const row: LocalTask = {
    ...existing,
    title,
    notes: params.notes === undefined ? existing.notes : params.notes,
    updated_at: at,
  };
  await db.tasks.put(row);
  await enqueueUpsert('tasks', row.id, taskPayload(row));
  void drainQueue();
  return row;
}

export async function setLocalTaskScheduledFor(params: {
  id: string;
  userId: string;
  scheduledFor: string | null;
}): Promise<LocalTask | null> {
  const db = getOfflineDb();
  const existing = await db.tasks.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return null;
  const at = nowIso();
  const row: LocalTask = {
    ...existing,
    scheduled_for: params.scheduledFor,
    updated_at: at,
  };
  await db.tasks.put(row);
  await enqueueUpsert('tasks', row.id, taskPayload(row));
  void drainQueue();
  return row;
}

export async function tombstoneLocalTask(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.tasks.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  const row: LocalTask = { ...existing, deleted_at: at, updated_at: at };
  await db.tasks.put(row);
  await enqueueUpsert('tasks', row.id, taskPayload(row));
  void drainQueue();
}

export async function getLocalTask(id: string, userId: string): Promise<LocalTask | null> {
  const row = await getOfflineDb().tasks.get(id);
  if (!row || row.user_id !== userId || row.deleted_at) return null;
  return row;
}

export async function listLocalTasks(userId: string): Promise<LocalTask[]> {
  return (await getOfflineDb().tasks.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
}

export async function listLocalTasksForDate(
  userId: string,
  logicalDate: string,
): Promise<LocalTask[]> {
  const rows = await getOfflineDb().tasks.where('user_id').equals(userId).toArray();
  return rows
    .filter((row) => !row.deleted_at && row.scheduled_for === logicalDate)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
}

export async function listLocalOverdueTasks(
  userId: string,
  today: string,
  nowIso: string,
): Promise<LocalTask[]> {
  const rows = await getOfflineDb().tasks.where('user_id').equals(userId).toArray();
  return rows
    .filter((row) => {
      if (row.deleted_at || row.completed_at) return false;
      if (row.scheduled_for === today) return false;
      if (row.due_at && row.due_at < nowIso) return true;
      if (row.scheduled_for && row.scheduled_for < today) return true;
      return false;
    })
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
}

export async function listLocalOpenTasks(userId: string): Promise<LocalTask[]> {
  const rows = await getOfflineDb().tasks.where('user_id').equals(userId).toArray();
  return rows
    .filter((row) => !row.deleted_at && !row.completed_at)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
}

export async function createLocalRoutine(input: {
  userId: string;
  title: string;
  notes?: string | null;
  scheduleDays?: number[];
  preferredTime?: string | null;
  sortOrder?: number;
  id?: string;
}): Promise<LocalRoutine> {
  const at = nowIso();
  const row: LocalRoutine = {
    id: input.id ?? newId(),
    user_id: input.userId,
    title: input.title.trim(),
    notes: input.notes ?? null,
    schedule_days: [...new Set(input.scheduleDays ?? [0, 1, 2, 3, 4, 5, 6])].sort(
      (a, b) => a - b,
    ),
    preferred_time: input.preferredTime ?? null,
    active: true,
    sort_order: input.sortOrder ?? 0,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().routines.put(row);
  await enqueueUpsert('routines', row.id, routinePayload(row));
  void drainQueue();
  return row;
}

export async function tombstoneLocalRoutine(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.routines.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  const row: LocalRoutine = { ...existing, deleted_at: at, updated_at: at };
  await db.routines.put(row);
  await enqueueUpsert('routines', row.id, routinePayload(row));
  void drainQueue();
}

export async function listLocalRoutines(
  userId: string,
  weekday?: number,
): Promise<LocalRoutine[]> {
  const rows = await getOfflineDb().routines.where('user_id').equals(userId).toArray();
  return rows
    .filter(
      (row) =>
        !row.deleted_at &&
        row.active &&
        (weekday === undefined || row.schedule_days.includes(weekday)),
    )
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
}

export async function completeLocalRoutine(input: {
  userId: string;
  routineId: string;
  logicalDate: string;
  completedAt?: string;
  id?: string;
}): Promise<LocalRoutineCompletion> {
  const db = getOfflineDb();
  const routine = await db.routines.get(input.routineId);
  if (!routine || routine.user_id !== input.userId || routine.deleted_at) {
    throw new Error('Cannot complete a routine that is missing, deleted, or not owned');
  }
  const existing = await db.routine_completions
    .where('[routine_id+logical_date]')
    .equals([input.routineId, input.logicalDate])
    .filter((row) => row.user_id === input.userId && !row.deleted_at)
    .first();
  if (existing) return existing;

  const prior = (
    await db.routine_completions.where('routine_id').equals(input.routineId).toArray()
  )
    .filter((row) => !row.deleted_at && row.logical_date < input.logicalDate)
    .sort((a, b) => b.logical_date.localeCompare(a.logical_date))[0];

  const at = input.completedAt ?? nowIso();
  const row: LocalRoutineCompletion = {
    id: input.id ?? newId(),
    user_id: input.userId,
    routine_id: input.routineId,
    logical_date: input.logicalDate,
    completed_at: at,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await db.routine_completions.put(row);
  await enqueueUpsert('routine_completions', row.id, routineCompletionPayload(row));
  await createLocalCompanionEvent({
    userId: input.userId,
    eventType: 'routine_completed',
    sourceTable: 'routine_completions',
    sourceId: row.id,
    logicalDate: row.logical_date,
  });
  if (
    prior &&
    Date.parse(`${row.logical_date}T00:00:00Z`) -
      Date.parse(`${prior.logical_date}T00:00:00Z`) >=
      2 * 86_400_000
  ) {
    await createLocalCompanionEvent({
      userId: input.userId,
      eventType: 'recovery_return',
      sourceTable: 'routine_completions',
      sourceId: row.id,
      logicalDate: row.logical_date,
    });
  }
  void drainQueue();
  return row;
}

export async function listLocalRoutineCompletions(
  userId: string,
  logicalDate: string,
): Promise<LocalRoutineCompletion[]> {
  const rows = await getOfflineDb()
    .routine_completions.where('user_id')
    .equals(userId)
    .toArray();
  return rows.filter((row) => !row.deleted_at && row.logical_date === logicalDate);
}

export async function tombstoneLocalRoutineCompletion(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.routine_completions.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  const row: LocalRoutineCompletion = {
    ...existing,
    deleted_at: at,
    updated_at: at,
  };
  await db.routine_completions.put(row);
  await enqueueUpsert('routine_completions', row.id, routineCompletionPayload(row));
  void drainQueue();
}

export async function mergeRemoteTasks(rows: LocalTask[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.tasks.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.tasks.put(row);
    }
  }
}

export async function mergeRemoteRoutines(rows: LocalRoutine[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.routines.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.routines.put(row);
    }
  }
}

export async function mergeRemoteRoutineCompletions(
  rows: LocalRoutineCompletion[],
): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.routine_completions.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.routine_completions.put(row);
    }
  }
}
