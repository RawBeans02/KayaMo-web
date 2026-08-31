import { describe, expect, it } from 'vitest';
import { instantOnLogicalDate, localHourFromInstant, logicalDateFromInstant, addLogicalCalendarDays } from './logical-date';

describe('logicalDateFromInstant', () => {
  it('uses the Manila calendar date at midnight start', () => {
    expect(logicalDateFromInstant('2026-08-16T04:00:00.000Z', 'Asia/Manila', '00:00:00')).toBe(
      '2026-08-16',
    );
  });

  it('rolls back before day_starts_at', () => {
    expect(logicalDateFromInstant('2026-08-16T20:00:00.000Z', 'Asia/Manila', '06:00:00')).toBe(
      '2026-08-16',
    );
    expect(logicalDateFromInstant('2026-08-16T21:30:00.000Z', 'Asia/Manila', '06:00:00')).toBe(
      '2026-08-16',
    );
  });
});

describe('localHourFromInstant', () => {
  it('reads the hour in Asia/Manila', () => {
    expect(localHourFromInstant('2026-08-16T23:00:00.000Z', 'Asia/Manila')).toBe(7);
  });
});

describe('addLogicalCalendarDays', () => {
  it('steps calendar dates without using local timezone', () => {
    expect(addLogicalCalendarDays('2026-09-01', 1)).toBe('2026-09-02');
    expect(addLogicalCalendarDays('2026-08-31', 1)).toBe('2026-09-01');
  });
});

describe('instantOnLogicalDate', () => {
  it('lands back on the same Manila calendar date', () => {
    const instant = instantOnLogicalDate('2026-08-20', 'Asia/Manila', '00:00:00');
    expect(logicalDateFromInstant(instant, 'Asia/Manila', '00:00:00')).toBe('2026-08-20');
  });

  it('respects a night-shift day boundary', () => {
    const instant = instantOnLogicalDate('2026-08-20', 'Asia/Manila', '05:00:00');
    expect(logicalDateFromInstant(instant, 'Asia/Manila', '05:00:00')).toBe('2026-08-20');
  });
});
