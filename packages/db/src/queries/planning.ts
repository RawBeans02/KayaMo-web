import type {
  Routine,
  RoutineCompletion,
  RoutineCompletionInsert,
  RoutineInsert,
  Task,
  TaskInsert,
} from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitServerCursor } from './lww';
import { parseRoutineTitle, parseScheduleDays, parseTaskTitle } from '../write-schemas';

export type TaskWrite = Omit<TaskInsert, 'created_at' | 'id'> & {
  id: string;
  created_at?: string;
};

export type RoutineWrite = Omit<RoutineInsert, 'created_at' | 'id'> & {
  id: string;
  created_at?: string;
};

export type RoutineCompletionWrite = Omit<
  RoutineCompletionInsert,
  'created_at' | 'id'
> & {
  id: string;
  created_at?: string;
};

export type PlanningUpsertResult<T> =
  | { applied: true; reason: 'inserted' | 'updated'; row: T }
  | { applied: false; reason: 'stale_or_tombstoned'; row: T | null };

function toTaskInsert(row: TaskWrite): TaskInsert {
  return {
    ...omitServerCursor(row),
    title: parseTaskTitle(row.title),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

function toRoutineInsert(row: RoutineWrite): RoutineInsert {
  return {
    ...omitServerCursor(row),
    title: parseRoutineTitle(row.title),
    schedule_days: parseScheduleDays(row.schedule_days),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

function toRoutineCompletionInsert(row: RoutineCompletionWrite): RoutineCompletionInsert {
  return {
    ...omitServerCursor(row),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

export async function listTasksForDate(
  client: DbClient,
  params: { userId: string; logicalDate: string },
): Promise<Task[]> {
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('user_id', params.userId)
    .eq('scheduled_for', params.logicalDate)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listActiveRoutines(
  client: DbClient,
  params: { userId: string; weekday?: number },
): Promise<Routine[]> {
  let query = client
    .from('routines')
    .select('*')
    .eq('user_id', params.userId)
    .eq('active', true)
    .is('deleted_at', null);
  if (params.weekday !== undefined) {
    query = query.contains('schedule_days', [params.weekday]);
  }
  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listRoutineCompletionsForDate(
  client: DbClient,
  params: { userId: string; logicalDate: string },
): Promise<RoutineCompletion[]> {
  const { data, error } = await client
    .from('routine_completions')
    .select('*')
    .eq('user_id', params.userId)
    .eq('logical_date', params.logicalDate)
    .is('deleted_at', null)
    .order('completed_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

async function getTaskForSync(
  client: DbClient,
  id: string,
  userId: string,
): Promise<Task | null> {
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

async function getRoutineForSync(
  client: DbClient,
  id: string,
  userId: string,
): Promise<Routine | null> {
  const { data, error } = await client
    .from('routines')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

async function getRoutineCompletionForSync(
  client: DbClient,
  row: RoutineCompletionWrite,
): Promise<RoutineCompletion | null> {
  const byId = await client
    .from('routine_completions')
    .select('*')
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .maybeSingle();
  throwIfError(byId.error);
  if (byId.data) return byId.data;

  const byDay = await client
    .from('routine_completions')
    .select('*')
    .eq('routine_id', row.routine_id)
    .eq('logical_date', row.logical_date)
    .eq('user_id', row.user_id)
    .maybeSingle();
  throwIfError(byDay.error);
  return byDay.data;
}

export async function upsertTask(
  client: DbClient,
  row: TaskWrite,
): Promise<PlanningUpsertResult<Task>> {
  const payload = toTaskInsert(row);
  const { data: updated, error: updateError } = await client
    .from('tasks')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  if (updated?.[0]) return { applied: true, reason: 'updated', row: updated[0] };

  const { data: inserted, error: insertError } = await client
    .from('tasks')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insertError?.code === '23505') {
    return {
      applied: false,
      reason: 'stale_or_tombstoned',
      row: await getTaskForSync(client, row.id, row.user_id),
    };
  }
  throwIfError(insertError);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted };
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: await getTaskForSync(client, row.id, row.user_id),
  };
}

export async function upsertRoutine(
  client: DbClient,
  row: RoutineWrite,
): Promise<PlanningUpsertResult<Routine>> {
  const payload = toRoutineInsert(row);
  const { data: updated, error: updateError } = await client
    .from('routines')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  if (updated?.[0]) return { applied: true, reason: 'updated', row: updated[0] };

  const { data: inserted, error: insertError } = await client
    .from('routines')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insertError?.code === '23505') {
    return {
      applied: false,
      reason: 'stale_or_tombstoned',
      row: await getRoutineForSync(client, row.id, row.user_id),
    };
  }
  throwIfError(insertError);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted };
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: await getRoutineForSync(client, row.id, row.user_id),
  };
}

export async function upsertRoutineCompletion(
  client: DbClient,
  row: RoutineCompletionWrite,
): Promise<PlanningUpsertResult<RoutineCompletion>> {
  const payload = toRoutineCompletionInsert(row);
  const { data: updated, error: updateError } = await client
    .from('routine_completions')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  if (updated?.[0]) return { applied: true, reason: 'updated', row: updated[0] };

  const { data: inserted, error: insertError } = await client
    .from('routine_completions')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insertError?.code === '23505') {
    return {
      applied: false,
      reason: 'stale_or_tombstoned',
      row: await getRoutineCompletionForSync(client, row),
    };
  }
  throwIfError(insertError);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted };
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: await getRoutineCompletionForSync(client, row),
  };
}

async function tombstonePlanningRow(
  client: DbClient,
  table: 'tasks' | 'routines' | 'routine_completions',
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const updatedAt = clampUpdatedAtIso(params.updatedAt);
  const { data, error } = await client
    .from(table)
    .update({ deleted_at: updatedAt, updated_at: updatedAt })
    .eq('id', params.id)
    .eq('user_id', params.userId)
    .is('deleted_at', null)
    .select('id');
  throwIfError(error);
  if (!data?.length) throw new DbQueryError(`tombstone ${table} matched no live row`);
}

export async function tombstoneTask(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstonePlanningRow(client, 'tasks', params);
}

export async function tombstoneRoutine(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstonePlanningRow(client, 'routines', params);
}

export async function tombstoneRoutineCompletion(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstonePlanningRow(client, 'routine_completions', params);
}
