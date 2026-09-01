import type { LocalTimeBlock } from '@kayamo/offline';

export const DAY_START_MIN = 6 * 60;
export const DAY_END_MIN = 22 * 60;
export const HOUR_PX = 48;
export const SNAP_MIN = 15;

export function clampMinutes(value: number, min = 0, max = 24 * 60): number {
  return Math.max(min, Math.min(max, value));
}

export function snapMinutes(value: number, step = SNAP_MIN): number {
  return Math.round(clampMinutes(value) / step) * step;
}

export function shiftTimeRange(
  startMin: number,
  endMin: number,
  deltaMin: number,
  mode: 'move' | 'resize',
  dayStart = DAY_START_MIN,
  dayEnd = DAY_END_MIN,
): { startMin: number; endMin: number } {
  const duration = Math.max(SNAP_MIN, endMin - startMin);
  if (mode === 'move') {
    const start = snapMinutes(Math.max(dayStart, Math.min(dayEnd - duration, startMin + deltaMin)));
    return { startMin: start, endMin: start + duration };
  }
  const end = snapMinutes(Math.max(startMin + SNAP_MIN, Math.min(dayEnd, endMin + deltaMin)));
  return { startMin, endMin: end };
}

export function minutesToLabel(minutes: number): string {
  const safe = clampMinutes(minutes);
  const hour = Math.floor(safe / 60);
  const min = safe % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function labelToMinutes(label: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(label.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function blockTopPx(startMin: number): number {
  return ((clampMinutes(startMin) - DAY_START_MIN) / 60) * HOUR_PX;
}

export function blockHeightPx(startMin: number, endMin: number): number {
  return Math.max(HOUR_PX / 4, ((endMin - startMin) / 60) * HOUR_PX);
}

export function yToMinutes(y: number): number {
  return snapMinutes(DAY_START_MIN + (y / HOUR_PX) * 60);
}

export type TimeWindow = { startMin: number; endMin: number };

export function blocksOverlap(
  a: Pick<LocalTimeBlock, 'start_min' | 'end_min'>,
  b: Pick<LocalTimeBlock, 'start_min' | 'end_min'>,
): boolean {
  return a.start_min < b.end_min && b.start_min < a.end_min;
}

export function conflictIds(blocks: LocalTimeBlock[]): Set<string> {
  const hits = new Set<string>();
  for (let i = 0; i < blocks.length; i += 1) {
    const left = blocks[i];
    if (!left) continue;
    for (let j = i + 1; j < blocks.length; j += 1) {
      const right = blocks[j];
      if (!right) continue;
      if (blocksOverlap(left, right)) {
        hits.add(left.id);
        hits.add(right.id);
      }
    }
  }
  return hits;
}

export function openWindows(
  blocks: LocalTimeBlock[],
  dayStart = DAY_START_MIN,
  dayEnd = DAY_END_MIN,
): TimeWindow[] {
  const occupied = [...blocks]
    .filter((row) => row.flexibility !== 'ANYTIME')
    .sort((a, b) => a.start_min - b.start_min);
  const windows: TimeWindow[] = [];
  let cursor = dayStart;
  for (const block of occupied) {
    if (block.start_min - cursor >= SNAP_MIN) {
      windows.push({ startMin: cursor, endMin: block.start_min });
    }
    cursor = Math.max(cursor, block.end_min);
  }
  if (dayEnd - cursor >= SNAP_MIN) windows.push({ startMin: cursor, endMin: dayEnd });
  return windows;
}

export function openWindowsAfter(
  blocks: LocalTimeBlock[],
  nowMin: number,
  dayStart = DAY_START_MIN,
  dayEnd = DAY_END_MIN,
): TimeWindow[] {
  const cursor = Math.max(dayStart, nowMin);
  return openWindows(blocks, dayStart, dayEnd)
    .map((window) => ({
      startMin: Math.max(window.startMin, cursor),
      endMin: window.endMin,
    }))
    .filter((window) => window.endMin - window.startMin >= SNAP_MIN);
}

export function firstFit(
  windows: TimeWindow[],
  durationMin: number,
): TimeWindow | null {
  const need = Math.max(SNAP_MIN, durationMin);
  for (const window of windows) {
    if (window.endMin - window.startMin >= need) {
      return { startMin: window.startMin, endMin: window.startMin + need };
    }
  }
  return null;
}

export function hourMarks(dayStart = DAY_START_MIN, dayEnd = DAY_END_MIN): number[] {
  const marks: number[] = [];
  for (let min = dayStart; min < dayEnd; min += 60) marks.push(min);
  return marks;
}

export function startOfIsoWeek(logicalDate: string): string {
  const [year, month, day] = logicalDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1));
  const weekday = utc.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  const shifted = new Date(utc);
  shifted.setUTCDate(utc.getUTCDate() + delta);
  return shifted.toISOString().slice(0, 10);
}

export function weekDates(logicalDate: string): string[] {
  const start = startOfIsoWeek(logicalDate);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(`${start}T12:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + index);
    return next.toISOString().slice(0, 10);
  });
}
