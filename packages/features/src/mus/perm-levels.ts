export const MUS_PERM_LEVELS = ['read', 'suggest', 'edit w/ approval', 'edit', 'never'] as const;
export type MusPermLevel = (typeof MUS_PERM_LEVELS)[number];

export const MUS_PERM_MODULES = [
  { key: 'today', label: 'Food log · today', domain: 'physical_self' },
  { key: 'foods', label: 'Food catalog', domain: 'physical_self' },
  { key: 'verify', label: 'PH core rows', domain: 'physical_self' },
  { key: 'gym', label: 'Gym sessions', domain: 'physical_self' },
  { key: 'todos', label: 'Todos + timetable', domain: 'goals_planning' },
] as const;

export type MusPermModule = (typeof MUS_PERM_MODULES)[number]['key'];
export type MusPermDomain = (typeof MUS_PERM_MODULES)[number]['domain'];

export type MusPermLevels = Record<MusPermModule, MusPermLevel>;

export const DEFAULT_MUS_PERM_LEVELS: MusPermLevels = {
  today: 'edit w/ approval',
  foods: 'edit w/ approval',
  verify: 'suggest',
  gym: 'edit w/ approval',
  todos: 'edit',
};

const STORAGE_PREFIX = 'kayamo:mus-perm-levels:';

export function musPermStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isMusPermLevel(value: string): value is MusPermLevel {
  return (MUS_PERM_LEVELS as readonly string[]).includes(value);
}

export function cycleMusPermLevel(current: MusPermLevel): MusPermLevel {
  const index = MUS_PERM_LEVELS.indexOf(current);
  return MUS_PERM_LEVELS[(index + 1) % MUS_PERM_LEVELS.length] ?? 'read';
}

export function musMayRead(level: MusPermLevel): boolean {
  return level !== 'never';
}

/** Writes still go through a proposal card. `read` and `never` never apply. */
export function musMayWrite(level: MusPermLevel): boolean {
  return level === 'suggest' || level === 'edit w/ approval' || level === 'edit';
}

export function readableModuleCount(levels: MusPermLevels): number {
  return MUS_PERM_MODULES.filter((row) => musMayRead(levels[row.key])).length;
}

export function parseMusPermLevels(raw: unknown): MusPermLevels {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MUS_PERM_LEVELS };
  const record = raw as Record<string, unknown>;
  const next = { ...DEFAULT_MUS_PERM_LEVELS };
  for (const row of MUS_PERM_MODULES) {
    const value = record[row.key];
    if (typeof value === 'string' && isMusPermLevel(value)) next[row.key] = value;
  }
  return next;
}

export function readMusPermLevels(userId: string): MusPermLevels {
  if (typeof window === 'undefined') return { ...DEFAULT_MUS_PERM_LEVELS };
  try {
    const raw = window.localStorage.getItem(musPermStorageKey(userId));
    return parseMusPermLevels(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_MUS_PERM_LEVELS };
  }
}

export function writeMusPermLevels(userId: string, levels: MusPermLevels): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(musPermStorageKey(userId), JSON.stringify(levels));
}

export function domainAllowedFromLevels(
  levels: MusPermLevels,
  domain: MusPermDomain,
): boolean {
  return MUS_PERM_MODULES.some((row) => row.domain === domain && musMayRead(levels[row.key]));
}

export type CocoWriteModule = MusPermModule;

export function permModuleForAction(action: string): CocoWriteModule | null {
  if (action === 'log_food') return 'today';
  if (
    action === 'start_workout' ||
    action === 'add_session_exercise' ||
    action === 'replace_session_exercise' ||
    action === 'skip_session_exercise' ||
    action === 'edit_planned_set' ||
    action === 'schedule_workout'
  ) {
    return 'gym';
  }
  if (
    action === 'create_task' ||
    action === 'complete_task' ||
    action === 'edit_task' ||
    action === 'delete_task' ||
    action === 'schedule_task' ||
    action === 'create_time_block' ||
    action === 'move_time_block' ||
    action === 'bulk_edit_tasks' ||
    action === 'set_recurrence' ||
    action === 'create_routine' ||
    action === 'create_goal' ||
    action === 'start_focus'
  ) {
    return 'todos';
  }
  return null;
}
