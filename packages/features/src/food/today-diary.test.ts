import { describe, expect, it } from 'vitest';
import { isoWeekFromLogicalDate } from './week-headline';
import {
  formatDiaryDate,
  formatWeekDelta,
  groupEntriesByMeal,
  presenceCells,
  presenceCopy,
  provenanceSummary,
  proteinNote,
  verifyQueueNote,
  weekAverageBar,
  weekStripDays,
} from './today-diary';

describe('diary date and week chrome', () => {
  it('formats the long date and ISO week the design uses for 1 September 2026', () => {
    expect(formatDiaryDate('2026-09-01')).toBe('Tuesday, 1 September');
    expect(isoWeekFromLogicalDate('2026-09-01')).toBe(36);
  });

  it('writes an over-target delta without a minus that looks like failure, and never uses a hyphen-minus for under', () => {
    expect(formatWeekDelta(2100, 2000)).toBe('+100');
    expect(formatWeekDelta(1800, 2000)).toBe('−200');
  });

  it('caps the week bar at 100% when average is over the scaled target', () => {
    const bar = weekAverageBar(4000, 2000);
    expect(bar.fillPercent).toBe(100);
    expect(bar.tickPercent).toBeCloseTo(80);
  });
});

describe('week strip', () => {
  it('marks future days as not yet and does not fill past 100% on an over-target day', () => {
    const days = weekStripDays({
      today: '2026-09-01',
      viewDate: '2026-09-01',
      targetKcal: 2000,
      entries: [
        { logical_date: '2026-08-31', kcal: '1800' },
        { logical_date: '2026-09-01', kcal: '2600' },
      ],
    });
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ date: '2026-08-31', note: 'logged', value: '1,800' });
    expect(days[1]).toMatchObject({ date: '2026-09-01', note: 'today, so far', selected: true });
    expect(days[1]?.fillPercent).toBe(100);
    expect(days[2]).toMatchObject({ future: true, value: '—', note: 'not yet', fillPercent: 0 });
  });
});

describe('meal groups and provenance', () => {
  it('keeps empty slots visible and totals kcal per meal', () => {
    const groups = groupEntriesByMeal([
      {
        id: '1',
        meal_slot: 'tanghalian',
        logged_at: '2026-09-01T04:00:00.000Z',
        food_name_snapshot: 'Kanin',
        serving_label_snapshot: 'tasa',
        quantity: '1',
        kcal: '195',
        source: 'ph_core',
        confidence: '0.5',
      },
      {
        id: '2',
        meal_slot: 'tanghalian',
        logged_at: '2026-09-01T04:10:00.000Z',
        food_name_snapshot: 'Adobo',
        serving_label_snapshot: null,
        quantity: '1',
        kcal: '226',
        source: 'ph_core',
        confidence: '0.5',
      },
    ]);
    expect(groups.map((group) => group.slot)).toEqual(['almusal', 'tanghalian', 'meryenda', 'hapunan']);
    expect(groups[0]?.empty).toBe(true);
    expect(groups[1]).toMatchObject({ countLabel: '2 items', kcalLabel: '421', empty: false });
  });

  it('counts provenance buckets from today\'s rows', () => {
    expect(
      provenanceSummary([
        { source: 'ph_core' },
        { source: 'ph_core' },
        { source: 'llm' },
      ]),
    ).toEqual([
      { key: 'ph_core', label: 'PH core · estimated', value: 2 },
      { key: 'off', label: 'Brand · label data', value: 0 },
      { key: 'llm', label: 'Photo · range only', value: 1 },
    ]);
  });
});

describe('presence grid', () => {
  it('covers four Monday-aligned weeks and names a return after four quiet days', () => {
    const today = '2026-09-02';
    const entries = [
      { logical_date: '2026-08-17', kcal: '400' },
      { logical_date: '2026-08-22', kcal: '400' },
    ];
    const cells = presenceCells(today, entries);
    expect(cells).toHaveLength(28);
    expect(cells[0]?.date).toBe('2026-08-10');
    expect(presenceCopy(cells)).toMatch(/You came back after 4 quiet days in week 34/);
  });

  it('falls back to the standing line when there is no four-day gap', () => {
    const cells = presenceCells('2026-09-02', [{ logical_date: '2026-09-02', kcal: '100' }]);
    expect(presenceCopy(cells)).toBe('Coming back after four quiet days counts.');
  });
});

describe('secondary stats', () => {
  it('does not invent a protein target or a verify total', () => {
    expect(proteinNote(42, null)).toEqual({ value: '42g', note: 'from your entries' });
    expect(verifyQueueNote([])).toEqual({ value: '—', note: 'PH core still loading' });
    expect(verifyQueueNote([{ source: 'ph_core' }, { source: 'ph_core', verified: true }])).toEqual({
      value: '1',
      note: 'rows left of 2',
    });
  });
});
