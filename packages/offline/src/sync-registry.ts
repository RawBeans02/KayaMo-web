import { BIDIRECTIONAL_SYNC_CONTRACT, type SyncTableContract } from '@kayamo/db';
import type { SyncableTable } from './db';

export type SyncTableSpec = SyncTableContract & { table: SyncableTable };

/**
 * Explicit allowlist for the v1 server-to-device feed. A Dexie table is never
 * synchronized merely because it exists.
 */
export const BIDIRECTIONAL_SYNC_REGISTRY: readonly SyncTableSpec[] =
  BIDIRECTIONAL_SYNC_CONTRACT;

export const LOCAL_ONLY_TABLES = [
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
  'rest_timers',
  'gym_session_items',
  'gym_planned_sets',
  'gym_session_events',
  'gym_prefs',
  'gym_busy_equipment',
] as const;

export function syncSpecFor(table: SyncableTable): SyncTableSpec {
  const spec = BIDIRECTIONAL_SYNC_REGISTRY.find((candidate) => candidate.table === table);
  if (!spec) throw new Error(`Unsupported pull table: ${table}`);
  return spec;
}
