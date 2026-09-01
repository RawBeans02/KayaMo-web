import { describe, expect, it } from 'vitest';
import type { LocalTimeBlock } from '@kayamo/offline';
import {
  blocksOverlap,
  conflictIds,
  firstFit,
  minutesToLabel,
  openWindows,
  openWindowsAfter,
  shiftTimeRange,
  DAY_START_MIN,
  snapMinutes,
  startOfIsoWeek,
  weekDates,
} from './timetable';

function block(
  id: string,
  start: number,
  end: number,
): LocalTimeBlock {
  return {
    id,
    user_id: 'u',
    logical_date: '2026-09-01',
    title: id,
    kind: 'TASK',
    start_min: start,
    end_min: end,
    flexibility: 'FLEXIBLE',
    locked: false,
    source_table: 'none',
    source_id: null,
    notes: null,
    created_at: 't',
    updated_at: 't',
    deleted_at: null,
  };
}

describe('timetable math', () => {
  it('snaps and labels minutes', () => {
    expect(snapMinutes(67)).toBe(60);
    expect(minutesToLabel(90)).toBe('01:30');
  });

  it('detects overlaps and open windows', () => {
    const classBlock = block('class', 9 * 60, 11 * 60);
    const gym = block('gym', 10 * 60, 12 * 60);
    expect(blocksOverlap(classBlock, gym)).toBe(true);
    expect([...conflictIds([classBlock, gym])].sort()).toEqual(['class', 'gym']);
    const gaps = openWindows([classBlock], 8 * 60, 14 * 60);
    expect(firstFit(gaps, 60)).toEqual({ startMin: 8 * 60, endMin: 9 * 60 });
    expect(openWindowsAfter([classBlock], 15 * 60, 8 * 60, 18 * 60)).toEqual([
      { startMin: 15 * 60, endMin: 18 * 60 },
    ]);
    expect(firstFit(openWindowsAfter([classBlock], 12 * 60, 8 * 60, 14 * 60), 60)).toEqual({
      startMin: 12 * 60,
      endMin: 13 * 60,
    });
    expect(firstFit(openWindowsAfter([classBlock], 13 * 60 + 30, 8 * 60, 14 * 60), 60)).toBeNull();
  });

  it('moves and resizes ranges on a 15-minute grid', () => {
    expect(shiftTimeRange(9 * 60, 10 * 60, -15, 'move')).toEqual({
      startMin: 8 * 60 + 45,
      endMin: 9 * 60 + 45,
    });
    expect(shiftTimeRange(9 * 60, 10 * 60, 15, 'resize')).toEqual({
      startMin: 9 * 60,
      endMin: 10 * 60 + 15,
    });
    expect(shiftTimeRange(DAY_START_MIN, DAY_START_MIN + 30, -60, 'move').startMin).toBe(DAY_START_MIN);
  });

  it('starts the week on Monday', () => {
    expect(startOfIsoWeek('2026-09-01')).toBe('2026-08-31');
    expect(weekDates('2026-09-01')[0]).toBe('2026-08-31');
    expect(weekDates('2026-09-01')[6]).toBe('2026-09-06');
  });
});
