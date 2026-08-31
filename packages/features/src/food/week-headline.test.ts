import { describe, expect, it } from 'vitest';
import {
  mondayOfLogicalWeek,
  pickHeadlineTarget,
  weekHeadline,
  weekKcalBars,
  type TargetRow,
} from './week-headline';

function target(partial: Partial<TargetRow> & Pick<TargetRow, 'day_type' | 'kcal'>): TargetRow {
  return {
    effective_from: '2026-08-01',
    protein_g: '120',
    carbs_g: '180',
    fat_g: '66',
    clamped: false,
    clamp_reasons: [],
    weekly_rate_percent: '0.5',
    confidence: '0.60',
    ...partial,
  };
}

describe('mondayOfLogicalWeek', () => {
  it('returns the same day when today is Monday', () => {
    expect(mondayOfLogicalWeek('2026-08-31')).toBe('2026-08-31');
  });

  it('walks back to Monday mid-week', () => {
    expect(mondayOfLogicalWeek('2026-09-01')).toBe('2026-08-31');
    expect(mondayOfLogicalWeek('2026-09-06')).toBe('2026-08-31');
  });
});

describe('weekHeadline', () => {
  it('averages only days that have logs', () => {
    const headline = weekHeadline({
      today: '2026-09-02',
      entries: [
        { logical_date: '2026-08-31', kcal: '400' },
        { logical_date: '2026-08-31', kcal: '200' },
        { logical_date: '2026-09-02', kcal: '1800' },
      ],
      target: pickHeadlineTarget([target({ day_type: 'rest', kcal: '2000' })]),
    });
    expect(headline.daysLogged).toBe(2);
    expect(headline.weekAverageKcal).toBe(1200);
    expect(headline.todayKcal).toBe(1800);
    expect(headline.remainingKcal).toBe(200);
    expect(headline.over).toBe(false);
  });

  it('frames an over-target day without inventing a failure state', () => {
    const headline = weekHeadline({
      today: '2026-08-31',
      entries: [{ logical_date: '2026-08-31', kcal: '2300' }],
      target: pickHeadlineTarget([target({ day_type: 'rest', kcal: '2000' })]),
    });
    expect(headline.over).toBe(true);
    expect(headline.remainingKcal).toBe(-300);
    expect(headline.targetKcal).toBe(2000);
  });

  it('leaves remaining empty when no target exists', () => {
    const headline = weekHeadline({
      today: '2026-08-31',
      entries: [{ logical_date: '2026-08-31', kcal: '500' }],
      target: null,
    });
    expect(headline.weekAverageKcal).toBe(500);
    expect(headline.remainingKcal).toBeNull();
    expect(headline.over).toBe(false);
  });

  it('ignores tombstones', () => {
    const headline = weekHeadline({
      today: '2026-08-31',
      entries: [
        { logical_date: '2026-08-31', kcal: '900', deleted_at: '2026-08-31T12:00:00.000Z' },
      ],
      target: null,
    });
    expect(headline.daysLogged).toBe(0);
    expect(headline.weekAverageKcal).toBeNull();
    expect(headline.todayKcal).toBe(0);
  });
});

describe('weekKcalBars', () => {
  it('always returns seven days and zeros empty ones', () => {
    const bars = weekKcalBars('2026-09-01', [
      { logical_date: '2026-08-31', kcal: '600' },
      { logical_date: '2026-09-01', kcal: '400' },
    ]);
    expect(bars).toHaveLength(7);
    expect(bars[0]).toMatchObject({ date: '2026-08-31', weekday: 'Mon', value: 600, future: false });
    expect(bars[1]).toMatchObject({ date: '2026-09-01', weekday: 'Tue', value: 400, future: false });
    expect(bars[2]).toMatchObject({ date: '2026-09-02', weekday: 'Wed', value: 0, future: true });
  });
});
