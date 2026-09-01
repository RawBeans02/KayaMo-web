import {
  defaultFacetsFor,
  isCircleKind,
  sanitizeFacets,
  type CircleKind,
} from '@kayamo/core';
import { getOfflineDb, type LocalCircle, type LocalSocialPrefs } from './db';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export async function getLocalSocialPrefs(userId: string): Promise<LocalSocialPrefs> {
  const existing = await getOfflineDb().social_prefs.get(userId);
  if (existing) return existing;
  return { user_id: userId, enabled: false, updated_at: nowIso() };
}

export async function saveLocalSocialPrefs(input: {
  userId: string;
  enabled: boolean;
}): Promise<LocalSocialPrefs> {
  const row: LocalSocialPrefs = {
    user_id: input.userId,
    enabled: input.enabled,
    updated_at: nowIso(),
  };
  await getOfflineDb().social_prefs.put(row);
  return row;
}

export async function createLocalCircle(input: {
  userId: string;
  name: string;
  kind: CircleKind;
  id?: string;
}): Promise<LocalCircle> {
  const at = nowIso();
  const row: LocalCircle = {
    id: input.id ?? newId(),
    user_id: input.userId,
    name: input.name.trim(),
    kind: input.kind,
    facets: defaultFacetsFor(input.kind),
    selected_goal_ids: [],
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().circles.put(row);
  return row;
}

export async function listLocalCircles(userId: string): Promise<LocalCircle[]> {
  return (await getOfflineDb().circles.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function updateLocalCircle(input: {
  id: string;
  userId: string;
  name?: string;
  facets?: readonly string[];
  selectedGoalIds?: readonly string[];
}): Promise<LocalCircle | null> {
  const db = getOfflineDb();
  const existing = await db.circles.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  const kind = isCircleKind(existing.kind) ? existing.kind : 'custom';
  const row: LocalCircle = {
    ...existing,
    kind,
    name: input.name?.trim() || existing.name,
    facets: input.facets ? sanitizeFacets(input.facets) : existing.facets,
    selected_goal_ids: input.selectedGoalIds
      ? [...new Set(input.selectedGoalIds.filter(Boolean))]
      : existing.selected_goal_ids,
    updated_at: nowIso(),
  };
  await db.circles.put(row);
  return row;
}

export async function tombstoneLocalCircle(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.circles.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  await db.circles.put({ ...existing, deleted_at: at, updated_at: at });
}
