import { describe, expect, it } from 'vitest';
import type { LocalTimeBlock } from '@kayamo/offline';
import {
  blocksOverlap,
  conflictIds,
  firstFit,
  minutesToLabel,
  openWindows,
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
  });

  it('starts the week on Monday', () => {
    expect(startOfIsoWeek('2026-09-01')).toBe('2026-08-31');
    expect(weekDates('2026-09-01')[0]).toBe('2026-08-31');
    expect(weekDates('2026-09-01')[6]).toBe('2026-09-06');
  });
});
