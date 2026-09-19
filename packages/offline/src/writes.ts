import type {
  FoodEntryWrite,
  MealTemplate,
  MealTemplateItem,
  MealTemplateWrite,
} from '@kayamo/db';
import { incomingWins } from '@kayamo/db';
import {
  getOfflineDb,
  type LocalFoodEntry,
  type LocalMealTemplate,
  type LocalWeightLog,
  type LocalWorkout,
} from './db';
import { logicalDateFromInstant } from './logical-date';
import { enqueueUpsert } from './queue';
import { drainQueue } from './sync';
import { createLocalCompanionEvent } from './journey';

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function requireNumeric(
  name: string,
  value: string,
  options: { positive?: boolean; max?: number } = {},
): void {
  const numeric = Number(value);
  if (
    !Number.isFinite(numeric) ||
    (options.positive ? numeric <= 0 : numeric < 0) ||
    (options.max !== undefined && numeric > options.max)
  ) {
    throw new Error(`${name} is outside the allowed range`);
  }
}

export type LogFoodEntryInput = {
  userId: string;
  mealSlot: FoodEntryWrite['meal_slot'];
  foodId: string | null;
  foodName: string;
  quantity: string;
  grams: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  source: FoodEntryWrite['source'];
  resolvedVia: FoodEntryWrite['resolved_via'];
  inputMethod: FoodEntryWrite['input_method'];
  servingId?: string | null;
  servingLabel?: string | null;
  confidence?: string;
  timeZone?: string;
  dayStartsAt?: string;
  loggedAt?: string;
};

export async function logFoodEntry(input: LogFoodEntryInput): Promise<LocalFoodEntry> {
  requireNumeric('quantity', input.quantity, { positive: true });
  requireNumeric('grams', input.grams, { positive: true });
  for (const [name, value] of Object.entries({
    kcal: input.kcal,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g,
    sugar_g: input.sugar_g,
    sodium_mg: input.sodium_mg,
  })) {
    requireNumeric(name, value);
  }
  requireNumeric('confidence', input.confidence ?? '0.80', { max: 1 });
  const loggedAt = input.loggedAt ?? nowIso();
  const updatedAt = loggedAt;
  const entry: LocalFoodEntry = {
    id: newId(),
    user_id: input.userId,
    logged_at: loggedAt,
    logical_date: logicalDateFromInstant(loggedAt, input.timeZone, input.dayStartsAt),
    meal_slot: input.mealSlot,
    food_id: input.foodId,
    recipe_id: null,
    quantity: input.quantity,
    serving_id: input.servingId ?? null,
    grams: input.grams,
    kcal: input.kcal,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g,
    sugar_g: input.sugar_g,
    sodium_mg: input.sodium_mg,
    source: input.source,
    confidence: input.confidence ?? '0.80',
    input_method: input.inputMethod,
    photo_url: null,
    raw_input: null,
    food_name_snapshot: input.foodName,
    serving_label_snapshot: input.servingLabel ?? null,
    resolved_via: input.resolvedVia,
    created_at: loggedAt,
    updated_at: updatedAt,
    server_updated_at: loggedAt,
    deleted_at: null,
  };

  await getOfflineDb().food_entries.put(entry);
  await enqueueUpsert('food_entries', entry.id, toFoodEntryPayload(entry));
  await createLocalCompanionEvent({
    userId: input.userId,
    eventType: 'food_logged',
    sourceTable: 'food_entries',
    sourceId: entry.id,
    logicalDate: entry.logical_date,
  });
  void drainQueue();
  return entry;
}

export async function logFoodEntries(
  inputs: LogFoodEntryInput[],
): Promise<LocalFoodEntry[]> {
  const rows: LocalFoodEntry[] = [];
  for (const input of inputs) {
    rows.push(await logFoodEntry(input));
  }
  return rows;
}

export async function tombstoneLocalFoodEntries(params: {
  ids: readonly string[];
  userId: string;
}): Promise<void> {
  for (const id of params.ids) {
    await tombstoneLocalFoodEntry({ id, userId: params.userId });
  }
}

export async function reviseLocalFoodEntry(input: {
  id: string;
  userId: string;
  quantity: string;
  grams: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  servingId?: string | null;
  servingLabel?: string | null;
}): Promise<LocalFoodEntry | null> {
  requireNumeric('quantity', input.quantity, { positive: true });
  requireNumeric('grams', input.grams, { positive: true });
  for (const [name, value] of Object.entries({
    kcal: input.kcal,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g,
    sugar_g: input.sugar_g,
    sodium_mg: input.sodium_mg,
  })) {
    requireNumeric(name, value);
  }
  const db = getOfflineDb();
  const existing = await db.food_entries.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  const updatedAt = nowIso();
  const next: LocalFoodEntry = {
    ...existing,
    quantity: input.quantity,
    grams: input.grams,
    kcal: input.kcal,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g,
    sugar_g: input.sugar_g,
    sodium_mg: input.sodium_mg,
    serving_id: input.servingId === undefined ? existing.serving_id : input.servingId,
    serving_label_snapshot:
      input.servingLabel === undefined ? existing.serving_label_snapshot : input.servingLabel,
    updated_at: updatedAt,
  };
  await db.food_entries.put(next);
  await enqueueUpsert('food_entries', next.id, toFoodEntryPayload(next));
  void drainQueue();
  return next;
}

export async function restoreLocalFoodEntry(params: {
  id: string;
  userId: string;
}): Promise<LocalFoodEntry | null> {
  const db = getOfflineDb();
  const existing = await db.food_entries.get(params.id);
  if (!existing || existing.user_id !== params.userId) return null;
  const updatedAt = nowIso();
  const next: LocalFoodEntry = {
    ...existing,
    deleted_at: null,
    updated_at: updatedAt,
  };
  await db.food_entries.put(next);
  await enqueueUpsert('food_entries', next.id, toFoodEntryPayload(next));
  void drainQueue();
  return next;
}

/**
 * How long a deleted food entry can be undone. The diary shows an Undo for this
 * long, and the tombstone is held back from the server for the same time. The
 * two must agree: server tombstones are irreversible (the update policy hides
 * deleted rows and a trigger keeps deleted_at), so a tombstone that ships before
 * the person taps Undo cannot be taken back, and the restore that follows is
 * silently rejected and re-deleted on the next pull.
 */
export const FOOD_ENTRY_UNDO_MS = 8000;

export async function tombstoneLocalFoodEntry(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.food_entries.get(params.id);
  if (!existing || existing.user_id !== params.userId) return;
  const updatedAt = nowIso();
  const next: LocalFoodEntry = {
    ...existing,
    deleted_at: updatedAt,
    updated_at: updatedAt,
  };
  await db.food_entries.put(next);
  // Held for the undo window. A restore inside it replaces this queue item
  // (same id) with the live row, so the server never sees the delete.
  await enqueueUpsert('food_entries', next.id, toFoodEntryPayload(next), {
    delayMs: FOOD_ENTRY_UNDO_MS,
  });
  void drainQueue();
  // The drain only takes due items and does not re-arm itself for future ones,
  // so make sure something drains once the window closes. If the tab is gone by
  // then, the item is still in the queue and ships on the next drain trigger.
  setTimeout(() => void drainQueue(), FOOD_ENTRY_UNDO_MS + 50);
}

export async function listLocalFoodEntries(
  userId: string,
  logicalDate: string,
): Promise<LocalFoodEntry[]> {
  const rows = await getOfflineDb()
    .food_entries.where('user_id')
    .equals(userId)
    .toArray();
  return rows
    .filter((row) => row.logical_date === logicalDate && !row.deleted_at)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

/**
 * Foods the user has logged before, for re-logging: palette recents, the search
 * fallback, the Foods page. Only rows with a catalog `food_id` qualify, because
 * a row with none cannot be re-logged from the catalog. Do not use this for
 * totals; see listLocalFoodLedger.
 */
export async function listLocalFoodHistory(userId: string): Promise<LocalFoodEntry[]> {
  const rows = await getOfflineDb()
    .food_entries.where('user_id')
    .equals(userId)
    .toArray();
  return rows
    .filter((row) => !row.deleted_at && row.food_id)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

/**
 * Every live entry the user has logged, catalogued or not. This is what a
 * total, an average or a presence grid must read. The diary used the history
 * query for its week statistics, so every worldwide-search and personal food
 * (which carry no catalog food_id) vanished from the week average, the strip
 * and the presence grid while still appearing in the day's own list.
 */
export async function listLocalFoodLedger(userId: string): Promise<LocalFoodEntry[]> {
  const rows = await getOfflineDb()
    .food_entries.where('user_id')
    .equals(userId)
    .toArray();
  return rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

export async function mergeRemoteFoodEntries(rows: LocalFoodEntry[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.food_entries.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.food_entries.put(row);
    }
  }
}

export async function saveMealTemplate(input: {
  userId: string;
  name: string;
  items: MealTemplateItem[];
  id?: string;
}): Promise<LocalMealTemplate> {
  const updatedAt = nowIso();
  const row: LocalMealTemplate = {
    id: input.id ?? newId(),
    user_id: input.userId,
    name: input.name.trim(),
    items: input.items,
    created_at: updatedAt,
    updated_at: updatedAt,
    server_updated_at: updatedAt,
    deleted_at: null,
  };
  await getOfflineDb().meal_templates.put(row);
  await enqueueUpsert('meal_templates', row.id, toMealTemplatePayload(row));
  void drainQueue();
  return row;
}

export async function listLocalMealTemplates(
  userId: string,
): Promise<LocalMealTemplate[]> {
  const rows = await getOfflineDb()
    .meal_templates.where('user_id')
    .equals(userId)
    .toArray();
  return rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function tombstoneLocalMealTemplate(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.meal_templates.get(params.id);
  if (!existing || existing.user_id !== params.userId) return;
  const updatedAt = nowIso();
  const next: LocalMealTemplate = {
    ...existing,
    deleted_at: updatedAt,
    updated_at: updatedAt,
  };
  await db.meal_templates.put(next);
  await enqueueUpsert('meal_templates', next.id, toMealTemplatePayload(next));
  void drainQueue();
}

export async function mergeRemoteMealTemplates(rows: MealTemplate[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.meal_templates.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.meal_templates.put(row);
    }
  }
}

export async function logWeight(input: {
  userId: string;
  weightKg: string;
  source: LocalWeightLog['source'];
  timeZone?: string;
  dayStartsAt?: string;
  loggedAt?: string;
}): Promise<LocalWeightLog> {
  requireNumeric('weightKg', input.weightKg, { positive: true });
  const loggedAt = input.loggedAt ?? nowIso();
  const logicalDate = logicalDateFromInstant(loggedAt, input.timeZone, input.dayStartsAt);
  const row: LocalWeightLog = {
    id: newId(),
    user_id: input.userId,
    logged_at: loggedAt,
    measured_on: logicalDate,
    logical_date: logicalDate,
    weight_kg: input.weightKg,
    source: input.source,
    created_at: loggedAt,
    updated_at: loggedAt,
    server_updated_at: loggedAt,
    deleted_at: null,
  };
  await getOfflineDb().weight_logs.put(row);
  await enqueueUpsert('weight_logs', row.id, toWeightLogPayload(row));
  void drainQueue();
  return row;
}

export async function listLocalWeightLogs(userId: string): Promise<LocalWeightLog[]> {
  const rows = await getOfflineDb().weight_logs.where('user_id').equals(userId).toArray();
  return rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

export async function tombstoneLocalWeightLog(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.weight_logs.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const updatedAt = nowIso();
  const next: LocalWeightLog = {
    ...existing,
    deleted_at: updatedAt,
    updated_at: updatedAt,
  };
  await db.weight_logs.put(next);
  await enqueueUpsert('weight_logs', next.id, toWeightLogPayload(next));
  void drainQueue();
}

export async function mergeRemoteWeightLogs(rows: LocalWeightLog[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.weight_logs.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.weight_logs.put(row);
    }
  }
}

/**
 * Explicit local companion to the server recompute RPC. This never runs as a
 * side effect of changing profile settings and does not enqueue ordinary LWW
 * writes because logical_date is server-owned at the write boundary.
 */
export async function recomputeLocalLogicalDates(params: {
  userId: string;
  timeZone: string;
  dayStartsAt: string;
}): Promise<{ food_entries: number; weight_logs: number; workouts: number }> {
  const db = getOfflineDb();
  const counts = { food_entries: 0, weight_logs: 0, workouts: 0 };
  await db.transaction('rw', db.food_entries, db.weight_logs, db.workouts, async () => {
    const foods = await db.food_entries.where('user_id').equals(params.userId).toArray();
    for (const row of foods) {
      if (row.deleted_at) continue;
      const logicalDate = logicalDateFromInstant(
        row.logged_at,
        params.timeZone,
        params.dayStartsAt,
      );
      if (logicalDate !== row.logical_date) {
        await db.food_entries.update(row.id, { logical_date: logicalDate });
        counts.food_entries += 1;
      }
    }
    const weights = await db.weight_logs.where('user_id').equals(params.userId).toArray();
    for (const row of weights) {
      if (row.deleted_at) continue;
      const logicalDate = logicalDateFromInstant(
        row.logged_at,
        params.timeZone,
        params.dayStartsAt,
      );
      if (logicalDate !== row.logical_date) {
        await db.weight_logs.update(row.id, { logical_date: logicalDate });
        counts.weight_logs += 1;
      }
    }
    const workouts = await db.workouts.where('user_id').equals(params.userId).toArray();
    for (const row of workouts) {
      if (row.deleted_at) continue;
      const logicalDate = logicalDateFromInstant(
        row.started_at,
        params.timeZone,
        params.dayStartsAt,
      );
      if (logicalDate !== row.logical_date) {
        await db.workouts.update(row.id, { logical_date: logicalDate });
        counts.workouts += 1;
      }
    }
  });
  return counts;
}

export async function logWorkout(input: {
  userId: string;
  notes?: string | null;
  timeZone?: string;
  dayStartsAt?: string;
}): Promise<LocalWorkout> {
  const startedAt = nowIso();
  const row: LocalWorkout = {
    id: newId(),
    user_id: input.userId,
    started_at: startedAt,
    ended_at: null,
    logical_date: logicalDateFromInstant(startedAt, input.timeZone, input.dayStartsAt),
    notes: input.notes ?? null,
    routine_id: null,
    plan_id: null,
    plan_day_index: null,
    status: 'active',
    is_deload: false,
    created_at: startedAt,
    updated_at: startedAt,
    server_updated_at: startedAt,
    deleted_at: null,
  };
  await getOfflineDb().workouts.put(row);
  await enqueueUpsert('workouts', row.id, { ...row });
  void drainQueue();
  return row;
}

function toFoodEntryPayload(entry: LocalFoodEntry): FoodEntryWrite {
  return {
    id: entry.id,
    user_id: entry.user_id,
    logged_at: entry.logged_at,
    meal_slot: entry.meal_slot,
    food_id: entry.food_id,
    recipe_id: entry.recipe_id,
    quantity: entry.quantity,
    serving_id: entry.serving_id,
    grams: entry.grams,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g,
    sugar_g: entry.sugar_g,
    sodium_mg: entry.sodium_mg,
    source: entry.source,
    confidence: entry.confidence,
    input_method: entry.input_method,
    photo_url: entry.photo_url,
    raw_input: entry.raw_input,
    food_name_snapshot: entry.food_name_snapshot,
    serving_label_snapshot: entry.serving_label_snapshot,
    resolved_via: entry.resolved_via,
    updated_at: entry.updated_at,
    deleted_at: entry.deleted_at,
  };
}

function toMealTemplatePayload(row: LocalMealTemplate): MealTemplateWrite {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    items: row.items,
    updated_at: row.updated_at,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
  };
}

function toWeightLogPayload(row: LocalWeightLog) {
  return {
    id: row.id,
    user_id: row.user_id,
    logged_at: row.logged_at,
    measured_on: row.measured_on,
    weight_kg: row.weight_kg,
    source: row.source,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}
