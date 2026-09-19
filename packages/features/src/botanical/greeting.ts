/**
 * The one line Lis says first on Home, built from the person's own records
 * and nothing else: no model call, no memory, no judgement. The evidence
 * brief (docs/research/2026-09-20-onboarding-and-lis-research.md) asks for
 * exactly this: one per day, self-referential, varied by what the data holds,
 * and warm about a gap without ever naming it as a failure.
 *
 * Pure so the copy can be tested against the banned-word list and every
 * branch can be pinned without a browser.
 */

import { shiftDay } from './progress-model';

export type GreetingInput = {
  /** The person's chosen display name, or null for a guest or an unset profile. */
  name: string | null;
  /** Logical date of today, YYYY-MM-DD. */
  today: string;
  /** Local hour, 0–23, in the person's own time zone. */
  hour: number;
  /** Calories confirmed today. */
  todayKcal: number;
  /** Meal slots with at least one entry today. */
  mealsLogged: number;
  /** The headline target for today, or null before onboarding. */
  targetKcal: number | null;
  /** Every logical date that carries at least one confirmed entry. */
  loggedDates: ReadonlySet<string>;
  /** Calories confirmed yesterday, or null when nothing was logged. */
  yesterdayKcal: number | null;
};

export type GreetingKind = 'first' | 'quiet' | 'normal' | 'gap';

export type Greeting = {
  kind: GreetingKind;
  /** Appended to the date line, e.g. "your first day". */
  dateNote: string | null;
  text: string;
};

/** Days without an entry before a return counts as coming back. */
export const GAP_DAYS = 3;

function salutation(hour: number, name: string | null, kind: GreetingKind): string {
  const who = name ? ' ' + name : '';
  if (kind === 'gap') return 'Welcome back' + who + '.';
  if (kind === 'first') return 'Hi' + who + '.';
  const word = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  return name ? word + ', ' + name + '.' : word + '.';
}

/** The next meal the day still holds, in the words the slots use. */
export function mealAhead(hour: number): string | null {
  if (hour < 10) return 'almusal';
  if (hour < 14) return 'tanghalian';
  if (hour < 17) return 'meryenda';
  if (hour < 21) return 'hapunan';
  return null;
}

function daysSince(loggedDates: ReadonlySet<string>, today: string): number | null {
  let cursor = shiftDay(today, -1);
  for (let gap = 1; gap <= 366; gap += 1) {
    if (loggedDates.has(cursor)) return gap;
    cursor = shiftDay(cursor, -1);
  }
  return null;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-PH');

export function homeGreeting(input: GreetingInput): Greeting {
  const { name, today, hour, todayKcal, mealsLogged, targetKcal, loggedDates, yesterdayKcal } =
    input;
  const everLogged = loggedDates.size > 0;
  const loggedToday = mealsLogged > 0;

  if (!everLogged) {
    return {
      kind: 'first',
      dateNote: 'your first day',
      text:
        salutation(hour, name, 'first') +
        ' Nothing logged yet, which is exactly right for a first day. When you eat, tell me and the numbers follow.',
    };
  }

  const gap = loggedToday ? null : daysSince(loggedDates, today);
  if (gap !== null && gap > GAP_DAYS) {
    const target = targetKcal
      ? ' Your target is still ' + fmt(targetKcal) + ' unless you would like to look at it again.'
      : '';
    return {
      kind: 'gap',
      dateNote: null,
      text:
        salutation(hour, name, 'gap') +
        ' It has been ' +
        gap +
        ' days, and the numbers pick up from today.' +
        target,
    };
  }

  if (!loggedToday) {
    const next = mealAhead(hour);
    return {
      kind: 'quiet',
      dateNote: null,
      text:
        salutation(hour, name, 'quiet') +
        (next
          ? ' Nothing logged yet today; ' + next + ' starts the count whenever you are ready.'
          : ' Nothing logged today, and that is fine. Tomorrow starts the count again.'),
    };
  }

  const next = mealAhead(hour);
  const sofar = targetKcal
    ? 'You are at ' + fmt(todayKcal) + ' of ' + fmt(targetKcal)
    : 'You are at ' + fmt(todayKcal) + ' kcal so far';
  const ahead = next ? ' with ' + next + ' still ahead' : '';
  let yesterday = '';
  if (yesterdayKcal !== null && targetKcal) {
    const ratio = yesterdayKcal / targetKcal;
    if (ratio >= 0.9 && ratio <= 1.1) yesterday = ', and yesterday landed right on target';
  } else if (yesterdayKcal !== null) {
    yesterday = ', and yesterday came to ' + fmt(yesterdayKcal);
  }
  return {
    kind: 'normal',
    dateNote: null,
    text: salutation(hour, name, 'normal') + ' ' + sofar + ahead + yesterday + '.',
  };
}

/** The streak chip's words: a run of days with an entry, never a debt. */
export function streakLabel(run: number, everLogged: boolean): string {
  if (run >= 1) return run === 1 ? '1 day' : run + ' days';
  return everLogged ? 'Picks up today' : 'Starts with today';
}
