import {
  COMPANION_EVENT_POINTS,
  COMPANION_STAGES,
  reduceCompanionEvents,
  type AchievementDefinition,
  type CompanionEventType,
  type CompanionProgression,
} from '@kayamo/core';

/**
 * Pure arithmetic behind Life and Grove: runs, counts per day, week buckets,
 * personal records, stage progress and achievements. Everything takes logical
 * dates as `YYYY-MM-DD` strings and never reads a clock, so it is testable and
 * the screens stay presentation.
 *
 * The words around these numbers are non-shaming by rule: a quiet day is a
 * zero in a series, never a loss, and nothing here computes a "broken" state.
 */

export const DAY_MS = 86_400_000;

export function shiftDay(iso: string, offset: number): string {
  const cursor = new Date(iso + 'T12:00:00Z');
  cursor.setUTCDate(cursor.getUTCDate() + offset);
  return cursor.toISOString().slice(0, 10);
}

/** `n` logical days ending on `today`, ascending. */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(today, i - (n - 1)));
}

export function countByDay(dates: Iterable<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const date of dates) out.set(date, (out.get(date) ?? 0) + 1);
  return out;
}

export function sumByDay(rows: Iterable<{ date: string; value: number }>): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.date, (out.get(row.date) ?? 0) + row.value);
  return out;
}

export function series(days: readonly string[], byDay: Map<string, number>): number[] {
  return days.map((day) => byDay.get(day) ?? 0);
}

/**
 * Consecutive days ending today that carry an entry. A day still in progress
 * does not break the run, which is why an empty today falls through to
 * yesterday rather than resetting the count.
 */
export function currentRun(dates: ReadonlySet<string>, today: string): number {
  let cursor = dates.has(today) ? today : shiftDay(today, -1);
  let run = 0;
  while (dates.has(cursor)) {
    run += 1;
    cursor = shiftDay(cursor, -1);
  }
  return run;
}

/** The longest run of consecutive days in the set, and the day it ended. */
export function longestRun(dates: ReadonlySet<string>): { length: number; endedOn: string | null } {
  let best = { length: 0, endedOn: null as string | null };
  for (const start of dates) {
    if (dates.has(shiftDay(start, -1))) continue; // not the start of a run
    let length = 0;
    let cursor = start;
    while (dates.has(cursor)) {
      length += 1;
      cursor = shiftDay(cursor, 1);
    }
    const endedOn = shiftDay(cursor, -1);
    if (length > best.length || (length === best.length && best.endedOn && endedOn > best.endedOn)) {
      best = { length, endedOn };
    }
  }
  return best;
}

/** The most entries inside any seven-day window, and the window's last day. */
export function bestWeek(byDay: Map<string, number>): { count: number; endedOn: string | null } {
  let best = { count: 0, endedOn: null as string | null };
  for (const end of byDay.keys()) {
    let count = 0;
    for (let i = 0; i < 7; i++) count += byDay.get(shiftDay(end, -i)) ?? 0;
    if (count > best.count) best = { count, endedOn: end };
  }
  return best;
}

export function firstDate(dates: Iterable<string>): string | null {
  let first: string | null = null;
  for (const date of dates) if (first === null || date < first) first = date;
  return first;
}

export type WeekBucket = { start: string; end: string };

/** `weeks` seven-day windows ending on `today`, oldest first. */
export function weekBuckets(today: string, weeks: number): WeekBucket[] {
  return Array.from({ length: weeks }, (_, i) => {
    const end = shiftDay(today, -7 * (weeks - 1 - i));
    return { start: shiftDay(end, -6), end };
  });
}

export function countInRange(dates: Iterable<string>, start: string, end: string): number {
  let n = 0;
  for (const date of dates) if (date >= start && date <= end) n += 1;
  return n;
}

export function inMonth(date: string, today: string): boolean {
  return date.slice(0, 7) === today.slice(0, 7);
}

/** Where the person stands between stages, for a progress reading. */
export function stageProgress(totalPoints: number): {
  current: (typeof COMPANION_STAGES)[number]['key'];
  next: (typeof COMPANION_STAGES)[number]['key'] | null;
  into: number;
  span: number;
  fraction: number;
} {
  const ordered = [...COMPANION_STAGES];
  let index = 0;
  for (let i = 0; i < ordered.length; i++) if (totalPoints >= ordered[i]!.minimumPoints) index = i;
  const current = ordered[index]!;
  const next = ordered[index + 1] ?? null;
  const into = totalPoints - current.minimumPoints;
  const span = next ? next.minimumPoints - current.minimumPoints : Math.max(into, 1);
  return {
    current: current.key,
    next: next?.key ?? null,
    into,
    span,
    fraction: next ? Math.min(1, into / span) : 1,
  };
}

/** A companion event as the ledger stores it; the shape Grove and Life read. */
export type LedgerEvent = {
  event_key: string;
  event_type: string;
  source_table: string;
  source_id: string;
  logical_date: string;
  created_at: string;
};

export type AchievementCopy = AchievementDefinition & { title: string; description: string };

/**
 * The six achievements the database seeds (achievement_definitions), with the
 * words a person reads. The rules mirror the seed exactly; the copy is
 * Lis-era (the seed's description of `sprout_stage` still names the old
 * companion, which is stored data and stays as it is).
 */
export const ACHIEVEMENTS: readonly AchievementCopy[] = [
  { key: 'first_step', title: 'First step', description: 'One confirmed action.', rule: { kind: 'event_count', threshold: 1 } },
  { key: 'ten_true_steps', title: 'Ten true steps', description: 'Ten confirmed actions.', rule: { kind: 'event_count', threshold: 10 } },
  { key: 'milestone_maker', title: 'Milestone maker', description: 'A goal step, confirmed.', rule: { kind: 'event_type_count', eventType: 'milestone_completed', threshold: 1 } },
  { key: 'goal_keeper', title: 'Goal keeper', description: 'A goal you chose, reached.', rule: { kind: 'event_type_count', eventType: 'goal_completed', threshold: 1 } },
  { key: 'welcome_back', title: 'Welcome back', description: 'Back to a routine or habit after time away.', rule: { kind: 'event_type_count', eventType: 'recovery_return', threshold: 1 } },
  { key: 'sprout_stage', title: 'New growth', description: 'Your grove reaches the sprout stage.', rule: { kind: 'total_points', threshold: 100 } },
];

export type AchievementStanding = AchievementCopy & {
  earnedOn: string | null;
  progress: number;
  threshold: number;
};

/**
 * Each achievement with how far along it is and, once earned, the logical
 * date of the event that earned it. Only events the ledger accepts count
 * (same rule as the points), taken in date order.
 */
export function achievementStandings(
  events: readonly LedgerEvent[],
  definitions: readonly AchievementCopy[] = ACHIEVEMENTS,
): AchievementStanding[] {
  const progression = reduceCompanionEvents(
    events.map((row) => ({
      eventKey: row.event_key,
      eventType: row.event_type as CompanionEventType,
      sourceTable: row.source_table,
      sourceId: row.source_id,
      logicalDate: row.logical_date,
    })),
  );
  const accepted = new Set(progression.acceptedEventKeys);
  const seen = new Set<string>();
  const ordered = events
    .slice()
    .sort((a, b) => a.logical_date.localeCompare(b.logical_date) || a.created_at.localeCompare(b.created_at))
    .filter((row) => {
      // One row per accepted key, the earliest, the same way the ledger counts.
      if (!accepted.has(row.event_key) || seen.has(row.event_key)) return false;
      seen.add(row.event_key);
      return true;
    });

  return definitions.map((definition) => {
    const { rule } = definition;
    let progress = 0;
    let earnedOn: string | null = null;
    let points = 0;
    for (const row of ordered) {
      if (rule.kind === 'event_count') progress += 1;
      else if (rule.kind === 'event_type_count') {
        if (row.event_type === rule.eventType) progress += 1;
      } else {
        points += COMPANION_EVENT_POINTS[row.event_type as CompanionEventType] ?? 0;
        progress = points;
      }
      if (earnedOn === null && progress >= rule.threshold) earnedOn = row.logical_date;
    }
    return { ...definition, earnedOn, progress: Math.min(progress, rule.threshold), threshold: rule.threshold };
  });
}

export function progressionOf(events: readonly LedgerEvent[]): CompanionProgression {
  return reduceCompanionEvents(
    events.map((row) => ({
      eventKey: row.event_key,
      eventType: row.event_type as CompanionEventType,
      sourceTable: row.source_table,
      sourceId: row.source_id,
      logicalDate: row.logical_date,
    })),
  );
}

export function shortDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function longDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
