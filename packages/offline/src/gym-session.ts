import {
  getOfflineDb,
  type GymSessionItemState,
  type LocalGymBusyEquipment,
  type LocalGymPlannedSet,
  type LocalGymPrefs,
  type LocalGymSessionEvent,
  type LocalGymSessionItem,
} from './db';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export const DEFAULT_GYM_REST_SECONDS = 150;

export function gymDraftSessionId(userId: string): string {
  return `draft:${userId}`;
}

export async function getLocalGymPrefs(userId: string): Promise<LocalGymPrefs> {
  const existing = await getOfflineDb().gym_prefs.get(userId);
  if (existing) return existing;
  const row: LocalGymPrefs = {
    user_id: userId,
    default_rest_seconds: DEFAULT_GYM_REST_SECONDS,
    favorite_slugs: [],
    avoid_slugs: [],
    updated_at: nowIso(),
  };
  await getOfflineDb().gym_prefs.put(row);
  return row;
}

export async function saveLocalGymPrefs(
  input: Partial<Omit<LocalGymPrefs, 'user_id'>> & { userId: string },
): Promise<LocalGymPrefs> {
  const existing = await getLocalGymPrefs(input.userId);
  const row: LocalGymPrefs = {
    ...existing,
    default_rest_seconds: input.default_rest_seconds ?? existing.default_rest_seconds,
    favorite_slugs: input.favorite_slugs ?? existing.favorite_slugs,
    avoid_slugs: input.avoid_slugs ?? existing.avoid_slugs,
    updated_at: nowIso(),
  };
  await getOfflineDb().gym_prefs.put(row);
  return row;
}

export async function recordGymSessionEvent(input: {
  userId: string;
  sessionId: string;
  eventType: string;
  entityId: string;
  summary: string;
}): Promise<LocalGymSessionEvent> {
  const row: LocalGymSessionEvent = {
    id: newId(),
    user_id: input.userId,
    session_id: input.sessionId,
    event_type: input.eventType,
    entity_id: input.entityId,
    summary: input.summary.slice(0, 280),
    created_at: nowIso(),
  };
  await getOfflineDb().gym_session_events.put(row);
  return row;
}

export async function listGymSessionItems(
  userId: string,
  sessionId: string,
): Promise<LocalGymSessionItem[]> {
  return (await getOfflineDb().gym_session_items.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at && row.session_id === sessionId)
    .sort((a, b) => a.sequence_index - b.sequence_index || a.created_at.localeCompare(b.created_at));
}

export async function listGymPlannedSets(
  userId: string,
  itemId: string,
): Promise<LocalGymPlannedSet[]> {
  return (await getOfflineDb().gym_planned_sets.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at && row.item_id === itemId)
    .sort((a, b) => a.set_index - b.set_index);
}

export async function getGymSessionItem(
  id: string,
  userId: string,
): Promise<LocalGymSessionItem | null> {
  const row = await getOfflineDb().gym_session_items.get(id);
  if (!row || row.user_id !== userId || row.deleted_at) return null;
  return row;
}

export async function getGymPlannedSet(
  id: string,
  userId: string,
): Promise<LocalGymPlannedSet | null> {
  const row = await getOfflineDb().gym_planned_sets.get(id);
  if (!row || row.user_id !== userId || row.deleted_at) return null;
  return row;
}

async function nextSequence(userId: string, sessionId: string): Promise<number> {
  const rows = await listGymSessionItems(userId, sessionId);
  return rows.reduce((max, row) => Math.max(max, row.sequence_index + 1), 0);
}

export async function addGymSessionItem(input: {
  userId: string;
  sessionId: string;
  slug: string;
  exerciseName: string;
  source?: LocalGymSessionItem['source'];
  locked?: boolean;
  targetSets?: number;
  targetReps?: number;
  targetWeightKg?: number | null;
  restSeconds?: number | null;
  setType?: LocalGymPlannedSet['set_type'];
  notes?: string | null;
}): Promise<LocalGymSessionItem> {
  const prefs = await getLocalGymPrefs(input.userId);
  const at = nowIso();
  const targetSets = Math.max(1, input.targetSets ?? 3);
  const item: LocalGymSessionItem = {
    id: newId(),
    user_id: input.userId,
    session_id: input.sessionId,
    slug: input.slug,
    exercise_name: input.exerciseName.trim().slice(0, 120),
    sequence_index: await nextSequence(input.userId, input.sessionId),
    source: input.source ?? 'manual',
    locked: input.locked ?? false,
    state: input.source === 'live' ? 'ADDED_LIVE' : 'QUEUED',
    substituted_from_id: null,
    notes: input.notes ?? null,
    discomfort: false,
    target_sets: targetSets,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().gym_session_items.put(item);
  const rest = input.restSeconds ?? prefs.default_rest_seconds;
  for (let index = 0; index < targetSets; index += 1) {
    const planned: LocalGymPlannedSet = {
      id: newId(),
      user_id: input.userId,
      item_id: item.id,
      set_index: index,
      set_type: input.setType ?? 'normal',
      target_reps: input.targetReps ?? 8,
      target_weight_kg: input.targetWeightKg ?? null,
      target_rir: null,
      rest_seconds: rest,
      performed_set_id: null,
      updated_at: at,
      deleted_at: null,
    };
    await getOfflineDb().gym_planned_sets.put(planned);
  }
  await recordGymSessionEvent({
    userId: input.userId,
    sessionId: input.sessionId,
    eventType: 'add_exercise',
    entityId: item.id,
    summary: `Added ${item.exercise_name}`,
  });
  return item;
}

export async function duplicateGymSessionItem(params: {
  userId: string;
  itemId: string;
  note?: string | null;
}): Promise<LocalGymSessionItem | null> {
  const db = getOfflineDb();
  const existing = await db.gym_session_items.get(params.itemId);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return null;
  const planned = await listGymPlannedSets(params.userId, existing.id);
  const clone = await addGymSessionItem({
    userId: params.userId,
    sessionId: existing.session_id,
    slug: existing.slug,
    exerciseName: existing.exercise_name,
    source: 'manual',
    locked: false,
    targetSets: planned.length || existing.target_sets,
    targetReps: planned[0]?.target_reps,
    targetWeightKg: planned[0]?.target_weight_kg ?? null,
    restSeconds: planned[0]?.rest_seconds ?? null,
    notes: params.note ?? existing.notes,
  });
  return clone;
}

export async function updateGymSessionItem(
  input: Partial<
    Pick<
      LocalGymSessionItem,
      'locked' | 'state' | 'notes' | 'discomfort' | 'sequence_index' | 'exercise_name' | 'slug'
    >
  > & { id: string; userId: string },
): Promise<LocalGymSessionItem | null> {
  const db = getOfflineDb();
  const existing = await db.gym_session_items.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  const row: LocalGymSessionItem = {
    ...existing,
    locked: input.locked ?? existing.locked,
    state: (input.state ?? existing.state) as GymSessionItemState,
    notes: input.notes === undefined ? existing.notes : input.notes,
    discomfort: input.discomfort ?? existing.discomfort,
    sequence_index: input.sequence_index ?? existing.sequence_index,
    exercise_name: input.exercise_name ?? existing.exercise_name,
    slug: input.slug ?? existing.slug,
    updated_at: nowIso(),
  };
  await db.gym_session_items.put(row);
  return row;
}

export async function tombstoneGymSessionItem(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.gym_session_items.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const planned = await listGymPlannedSets(params.userId, existing.id);
  if (planned.some((row) => row.performed_set_id)) {
    await updateGymSessionItem({ id: existing.id, userId: params.userId, state: 'SKIPPED' });
    return;
  }
  const at = nowIso();
  await db.gym_session_items.put({ ...existing, deleted_at: at, updated_at: at });
  for (const set of planned) {
    await db.gym_planned_sets.put({ ...set, deleted_at: at, updated_at: at });
  }
}

export async function reorderGymSessionItem(params: {
  id: string;
  userId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  const items = await listGymSessionItems(
    params.userId,
    (await getOfflineDb().gym_session_items.get(params.id))?.session_id ?? '',
  );
  const index = items.findIndex((row) => row.id === params.id);
  if (index < 0) return;
  const swapWith = params.direction === 'up' ? index - 1 : index + 1;
  const current = items[index];
  const other = items[swapWith];
  if (!current || !other) return;
  await updateGymSessionItem({
    id: current.id,
    userId: params.userId,
    sequence_index: other.sequence_index,
  });
  await updateGymSessionItem({
    id: other.id,
    userId: params.userId,
    sequence_index: current.sequence_index,
  });
  await recordGymSessionEvent({
    userId: params.userId,
    sessionId: current.session_id,
    eventType: 'reorder',
    entityId: current.id,
    summary: `Moved ${current.exercise_name} ${params.direction}`,
  });
}

export async function updateGymPlannedSet(
  input: Partial<
    Pick<
      LocalGymPlannedSet,
      'target_reps' | 'target_weight_kg' | 'target_rir' | 'rest_seconds' | 'set_type' | 'performed_set_id'
    >
  > & { id: string; userId: string },
): Promise<LocalGymPlannedSet | null> {
  const db = getOfflineDb();
  const existing = await db.gym_planned_sets.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  const row: LocalGymPlannedSet = {
    ...existing,
    target_reps: input.target_reps ?? existing.target_reps,
    target_weight_kg:
      input.target_weight_kg === undefined ? existing.target_weight_kg : input.target_weight_kg,
    target_rir: input.target_rir === undefined ? existing.target_rir : input.target_rir,
    rest_seconds: input.rest_seconds === undefined ? existing.rest_seconds : input.rest_seconds,
    set_type: input.set_type ?? existing.set_type,
    performed_set_id:
      input.performed_set_id === undefined ? existing.performed_set_id : input.performed_set_id,
    updated_at: nowIso(),
  };
  await db.gym_planned_sets.put(row);
  return row;
}

export async function addGymPlannedSet(params: {
  userId: string;
  itemId: string;
}): Promise<LocalGymPlannedSet | null> {
  const item = await getOfflineDb().gym_session_items.get(params.itemId);
  if (!item || item.user_id !== params.userId || item.deleted_at) return null;
  const existing = await listGymPlannedSets(params.userId, params.itemId);
  const last = existing[existing.length - 1];
  const row: LocalGymPlannedSet = {
    id: newId(),
    user_id: params.userId,
    item_id: params.itemId,
    set_index: (last?.set_index ?? -1) + 1,
    set_type: last?.set_type ?? 'normal',
    target_reps: last?.target_reps ?? 8,
    target_weight_kg: last?.target_weight_kg ?? null,
    target_rir: last?.target_rir ?? null,
    rest_seconds: last?.rest_seconds ?? DEFAULT_GYM_REST_SECONDS,
    performed_set_id: null,
    updated_at: nowIso(),
    deleted_at: null,
  };
  await getOfflineDb().gym_planned_sets.put(row);
  await getOfflineDb().gym_session_items.put({
    ...item,
    target_sets: existing.length + 1,
    updated_at: nowIso(),
  });
  return row;
}

export async function removeFutureGymPlannedSet(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.gym_planned_sets.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  if (existing.performed_set_id) return;
  const at = nowIso();
  await db.gym_planned_sets.put({ ...existing, deleted_at: at, updated_at: at });
}

export async function attachGymDraftToWorkout(params: {
  userId: string;
  workoutId: string;
}): Promise<void> {
  const draftId = gymDraftSessionId(params.userId);
  const items = await listGymSessionItems(params.userId, draftId);
  const at = nowIso();
  for (const item of items) {
    await getOfflineDb().gym_session_items.put({
      ...item,
      session_id: params.workoutId,
      updated_at: at,
    });
  }
  await recordGymSessionEvent({
    userId: params.userId,
    sessionId: params.workoutId,
    eventType: 'start',
    entityId: params.workoutId,
    summary: 'Started live session from the current frame',
  });
}

export async function cloneGymSessionToDraft(params: {
  userId: string;
  fromSessionId: string;
}): Promise<void> {
  const draftId = gymDraftSessionId(params.userId);
  const existingDraft = await listGymSessionItems(params.userId, draftId);
  for (const row of existingDraft) {
    await tombstoneGymSessionItem({ id: row.id, userId: params.userId });
  }
  const source = await listGymSessionItems(params.userId, params.fromSessionId);
  for (const item of source) {
    const planned = await listGymPlannedSets(params.userId, item.id);
    const clone = await addGymSessionItem({
      userId: params.userId,
      sessionId: draftId,
      slug: item.slug,
      exerciseName: item.exercise_name,
      source: 'copy',
      locked: item.locked,
      targetSets: planned.length || item.target_sets,
      targetReps: planned[0]?.target_reps,
      targetWeightKg: planned[0]?.target_weight_kg ?? null,
      restSeconds: planned[0]?.rest_seconds ?? null,
      notes: item.notes,
    });
    const cloneSets = await listGymPlannedSets(params.userId, clone.id);
    for (const [index, set] of cloneSets.entries()) {
      const from = planned[index];
      if (!from) continue;
      await updateGymPlannedSet({
        id: set.id,
        userId: params.userId,
        set_type: from.set_type,
        target_reps: from.target_reps,
        target_weight_kg: from.target_weight_kg,
        target_rir: from.target_rir,
        rest_seconds: from.rest_seconds,
      });
    }
  }
}

export async function substituteGymSessionItem(params: {
  userId: string;
  itemId: string;
  slug: string;
  exerciseName: string;
}): Promise<LocalGymSessionItem | null> {
  const existing = await getOfflineDb().gym_session_items.get(params.itemId);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return null;
  const planned = await listGymPlannedSets(params.userId, existing.id);
  const remaining = planned.filter((row) => !row.performed_set_id);
  await updateGymSessionItem({
    id: existing.id,
    userId: params.userId,
    state: planned.some((row) => row.performed_set_id) ? 'PARTIAL' : 'SUBSTITUTED',
  });
  if (planned.some((row) => row.performed_set_id)) {
    await updateGymSessionItem({ id: existing.id, userId: params.userId, state: 'SUBSTITUTED' });
  }
  const replacement = await addGymSessionItem({
    userId: params.userId,
    sessionId: existing.session_id,
    slug: params.slug,
    exerciseName: params.exerciseName,
    source: existing.session_id.startsWith('draft:') ? 'manual' : 'live',
    locked: existing.locked,
    targetSets: remaining.length || 1,
    targetReps: remaining[0]?.target_reps,
    targetWeightKg: remaining[0]?.target_weight_kg ?? null,
    restSeconds: remaining[0]?.rest_seconds ?? null,
  });
  await updateGymSessionItem({
    id: replacement.id,
    userId: params.userId,
    sequence_index: existing.sequence_index + 1,
  });
  await getOfflineDb().gym_session_items.put({
    ...replacement,
    substituted_from_id: existing.id,
    sequence_index: existing.sequence_index + 1,
    updated_at: nowIso(),
  });
  await recordGymSessionEvent({
    userId: params.userId,
    sessionId: existing.session_id,
    eventType: 'substitute',
    entityId: replacement.id,
    summary: `Replaced ${existing.exercise_name} with ${params.exerciseName}`,
  });
  return replacement;
}

export async function listGymBusyEquipment(
  userId: string,
  logicalDate: string,
): Promise<LocalGymBusyEquipment[]> {
  return (await getOfflineDb().gym_busy_equipment.where('user_id').equals(userId).toArray()).filter(
    (row) => row.logical_date === logicalDate,
  );
}

export async function toggleGymBusyEquipment(params: {
  userId: string;
  logicalDate: string;
  equipmentId: string;
}): Promise<boolean> {
  const db = getOfflineDb();
  const id = `${params.userId}:${params.logicalDate}:${params.equipmentId}`;
  const existing = await db.gym_busy_equipment.get(id);
  if (existing) {
    await db.gym_busy_equipment.delete(id);
    return false;
  }
  await db.gym_busy_equipment.put({
    id,
    user_id: params.userId,
    logical_date: params.logicalDate,
    equipment_id: params.equipmentId,
    updated_at: nowIso(),
  });
  return true;
}

export async function refreshGymItemState(params: {
  userId: string;
  itemId: string;
}): Promise<void> {
  const item = await getOfflineDb().gym_session_items.get(params.itemId);
  if (!item || item.user_id !== params.userId || item.deleted_at) return;
  if (item.state === 'SKIPPED' || item.state === 'SUBSTITUTED') return;
  const planned = await listGymPlannedSets(params.userId, item.id);
  const done = planned.filter((row) => row.performed_set_id).length;
  const next: GymSessionItemState =
    done === 0 ? (item.state === 'ADDED_LIVE' ? 'ADDED_LIVE' : 'QUEUED') : done >= planned.length ? 'COMPLETED' : 'PARTIAL';
  await updateGymSessionItem({ id: item.id, userId: params.userId, state: next });
}
