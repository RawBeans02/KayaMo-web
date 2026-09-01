import {
  nutritionProgress,
  targetForDayType,
  type NutritionTargetView,
} from '@kayamo/core';
import { shiftLogicalDate } from '@kayamo/food/quick-log';

export type HeadlineEntry = {
  logical_date: string;
  kcal: string;
  deleted_at?: string | null;
};

export type TargetRow = {
  day_type: string;
  effective_from: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  clamped: boolean;
  clamp_reasons: string[];
  weekly_rate_percent: string;
  confidence: string;
};

export type WeekHeadline = {
  weekAverageKcal: number | null;
  daysLogged: number;
  todayKcal: number;
  remainingKcal: number | null;
  over: boolean;
  targetKcal: number | null;
};

/** Monday of the ISO-style week that contains `today` (YYYY-MM-DD, no TZ). */
export function mondayOfLogicalWeek(today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  return shiftLogicalDate(today, -daysFromMonday);
}

/** ISO week number for a YYYY-MM-DD logical date (UTC calendar, no clock). */
export function isoWeekFromLogicalDate(logicalDate: string): number {
  const [year, month, day] = logicalDate.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function dailyKcalTotals(entries: readonly HeadlineEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of entries) {
    if (row.deleted_at) continue;
    const kcal = Number(row.kcal);
    if (!Number.isFinite(kcal)) continue;
    totals.set(row.logical_date, (totals.get(row.logical_date) ?? 0) + kcal);
  }
  return totals;
}

export function targetViewFromRow(row: TargetRow): NutritionTargetView {
  return {
    dayType: row.day_type,
    effectiveFrom: row.effective_from,
    kcal: Number(row.kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    clamped: row.clamped,
    clampReasons: row.clamp_reasons,
    weeklyRatePercent: Number(row.weekly_rate_percent),
    confidence: Number(row.confidence),
  };
}

export function pickHeadlineTarget(rows: readonly TargetRow[]): NutritionTargetView | null {
  const views = rows.map(targetViewFromRow);
  return targetForDayType(views, 'rest') ?? views[0] ?? null;
}

export type WeekBar = {
  date: string;
  weekday: string;
  value: number;
  future: boolean;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Always seven days, Monday through Sunday, so sparse weeks still graph. */
export function weekDaySeries(today: string, values: ReadonlyMap<string, number>): WeekBar[] {
  const start = mondayOfLogicalWeek(today);
  const bars: WeekBar[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = shiftLogicalDate(start, offset);
    bars.push({
      date,
      weekday: WEEKDAYS[offset] ?? 'Mon',
      value: Math.round(values.get(date) ?? 0),
      future: date > today,
    });
  }
  return bars;
}

export function weekKcalBars(today: string, entries: readonly HeadlineEntry[]): WeekBar[] {
  return weekDaySeries(today, dailyKcalTotals(entries));
}

/**
 * Week average is the mean of daily kcal for days that have at least one
 * entry, from Monday through today. Empty days are omitted so a sparse week
 * is not a fake zero. Remaining uses today's total against the rest target.
 */
export function weekHeadline(params: {
  today: string;
  entries: readonly HeadlineEntry[];
  target: NutritionTargetView | null;
}): WeekHeadline {
  const start = mondayOfLogicalWeek(params.today);
  const totals = dailyKcalTotals(params.entries);
  const logged: number[] = [];
  for (let date = start; date <= params.today; date = shiftLogicalDate(date, 1)) {
    const kcal = totals.get(date);
    if (kcal !== undefined) logged.push(kcal);
  }
  const todayKcal = Math.round(totals.get(params.today) ?? 0);
  const progress = nutritionProgress(todayKcal, params.target);
  const sum = logged.reduce((acc, value) => acc + value, 0);
  return {
    weekAverageKcal: logged.length === 0 ? null : Math.round(sum / logged.length),
    daysLogged: logged.length,
    todayKcal,
    remainingKcal: progress.remainingKcal,
    over: progress.over,
    targetKcal: progress.targetKcal,
  };
}
