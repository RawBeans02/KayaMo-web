import { orderedMealSlots, mealSlotLabel, asMealSlot, shiftLogicalDate, type MealSlot } from '@kayamo/food/quick-log';
import { dailyKcalTotals, isoWeekFromLogicalDate, mondayOfLogicalWeek, type HeadlineEntry } from './week-headline';

export { isoWeekFromLogicalDate };

export function formatDiaryDate(logicalDate: string): string {
  const [year, month, day] = logicalDate.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(date);
  const monthName = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  return `${weekday}, ${date.getUTCDate()} ${monthName}`;
}

export function formatWeekDelta(averageKcal: number | null, targetKcal: number | null): string | null {
  if (averageKcal === null || targetKcal === null || targetKcal <= 0) return null;
  const delta = Math.round(averageKcal - targetKcal);
  if (delta === 0) return '0';
  const sign = delta < 0 ? '−' : '+';
  return `${sign}${Math.abs(delta).toLocaleString('en-PH')}`;
}

export function weekAverageBar(averageKcal: number | null, targetKcal: number | null): {
  fillPercent: number;
  tickPercent: number | null;
} {
  if (targetKcal === null || targetKcal <= 0) {
    return { fillPercent: averageKcal ? 40 : 0, tickPercent: null };
  }
  const scale = targetKcal * 1.25;
  return {
    fillPercent: Math.min(((averageKcal ?? 0) / scale) * 100, 100),
    tickPercent: Math.min((targetKcal / scale) * 100, 100),
  };
}

export type WeekStripDay = {
  date: string;
  weekday: string;
  dayNum: string;
  value: string;
  note: string;
  kcal: number;
  fillPercent: number;
  isToday: boolean;
  selected: boolean;
  future: boolean;
};

export function weekStripDays(params: {
  today: string;
  viewDate: string;
  entries: readonly HeadlineEntry[];
  targetKcal: number | null;
}): WeekStripDay[] {
  const start = mondayOfLogicalWeek(params.today);
  const totals = dailyKcalTotals(params.entries);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  const days: WeekStripDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = shiftLogicalDate(start, offset);
    const future = date > params.today;
    const kcal = Math.round(totals.get(date) ?? 0);
    const isToday = date === params.today;
    const fillPercent =
      future || !params.targetKcal || params.targetKcal <= 0
        ? 0
        : Math.min((kcal / params.targetKcal) * 100, 100);
    days.push({
      date,
      weekday: weekdays[offset] ?? 'Mon',
      dayNum: date.slice(8),
      value: future ? '—' : kcal.toLocaleString('en-PH'),
      note: future ? 'not yet' : isToday ? 'today, so far' : kcal > 0 ? 'logged' : 'quiet',
      kcal,
      fillPercent: future ? 0 : fillPercent,
      isToday,
      selected: date === params.viewDate,
      future,
    });
  }
  return days;
}

export type DiaryEntry = {
  id: string;
  meal_slot: string;
  logged_at: string;
  food_name_snapshot: string;
  serving_label_snapshot: string | null;
  quantity: string;
  kcal: string;
  source: string;
  confidence: string;
};

export type MealGroup<T extends DiaryEntry = DiaryEntry> = {
  slot: MealSlot;
  label: string;
  rows: T[];
  countLabel: string;
  kcalLabel: string;
  empty: boolean;
};

export function groupEntriesByMeal<T extends DiaryEntry>(entries: readonly T[]): MealGroup<T>[] {
  return orderedMealSlots().map((slot) => {
    const rows = entries.filter((row) => asMealSlot(row.meal_slot) === slot);
    const kcal = rows.reduce((sum, row) => sum + (Number(row.kcal) || 0), 0);
    return {
      slot,
      label: mealSlotLabel(slot, 'taglish'),
      rows,
      countLabel: rows.length === 0 ? '' : `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`,
      kcalLabel: rows.length === 0 ? '' : Math.round(kcal).toLocaleString('en-PH'),
      empty: rows.length === 0,
    };
  });
}

export type ProvenanceBucket = {
  key: 'ph_core' | 'off' | 'llm';
  label: string;
  value: number;
};

export function provenanceSummary(entries: readonly { source: string }[]): ProvenanceBucket[] {
  const count = (source: string) => entries.filter((row) => row.source === source).length;
  return [
    { key: 'ph_core', label: 'PH core · estimated', value: count('ph_core') },
    { key: 'off', label: 'Brand · label data', value: count('off') },
    { key: 'llm', label: 'Photo · range only', value: count('llm') },
  ];
}

export type PresenceCell = {
  date: string;
  logged: boolean;
  future: boolean;
  isoWeek: number;
};

export function presenceCells(today: string, entries: readonly HeadlineEntry[]): PresenceCell[] {
  const start = shiftLogicalDate(mondayOfLogicalWeek(today), -21);
  const totals = dailyKcalTotals(entries);
  const cells: PresenceCell[] = [];
  for (let offset = 0; offset < 28; offset += 1) {
    const date = shiftLogicalDate(start, offset);
    cells.push({
      date,
      logged: (totals.get(date) ?? 0) > 0,
      future: date > today,
      isoWeek: isoWeekFromLogicalDate(date),
    });
  }
  return cells;
}

export function presenceCopy(cells: readonly PresenceCell[]): string {
  const past = cells.filter((cell) => !cell.future);
  let quiet = 0;
  let sawLogged = false;
  let lastReturn: { days: number; week: number } | null = null;
  for (const cell of past) {
    if (cell.logged) {
      if (sawLogged && quiet >= 4) lastReturn = { days: quiet, week: cell.isoWeek };
      quiet = 0;
      sawLogged = true;
    } else if (sawLogged) {
      quiet += 1;
    }
  }
  if (lastReturn) {
    return `You came back after ${lastReturn.days} quiet days in week ${lastReturn.week}. That counts.`;
  }
  return 'Coming back after four quiet days counts.';
}

export function verifyQueueNote(catalog: readonly { source: string; verified?: boolean }[]): {
  value: string;
  note: string;
} {
  const ph = catalog.filter((food) => food.source === 'ph_core');
  if (ph.length === 0) return { value: '—', note: 'PH core still loading' };
  const left = ph.filter((food) => food.verified !== true).length;
  return { value: String(left), note: `rows left of ${ph.length}` };
}

export function sessionNote(completedThisWeek: number): { value: string; note: string } {
  return {
    value: String(completedThisWeek),
    note: completedThisWeek === 1 ? 'this week · from Gym' : 'this week · from Gym',
  };
}

export function proteinNote(grams: number, targetG: number | null): { value: string; note: string } {
  const value = `${Math.round(grams)}g`;
  if (targetG === null || targetG <= 0) return { value, note: 'from your entries' };
  return { value, note: `against ${Math.round(targetG)}g · from your entries` };
}
