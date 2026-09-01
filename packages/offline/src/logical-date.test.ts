import { describe, expect, it } from 'vitest';
import { instantOnLogicalDate, localHourFromInstant, logicalDateFromInstant, addLogicalCalendarMonths } from './logical-date';

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

describe('addLogicalCalendarMonths', () => {
  it('clamps end-of-month instead of adding 30 days', () => {
    expect(addLogicalCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addLogicalCalendarMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addLogicalCalendarMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addLogicalCalendarMonths('2026-03-31', 1)).toBe('2026-04-30');
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
