import { describe, expect, it } from 'vitest';
import {
  achievementStandings,
  bestWeek,
  countByDay,
  currentRun,
  lastDays,
  longestRun,
  series,
  shiftDay,
  stageProgress,
  weekBuckets,
  type LedgerEvent,
} from './progress-model';

function event(
  type: string,
  date: string,
  n: number,
  sourceTable = 'tasks',
): LedgerEvent {
  const sourceId = `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  return {
    event_key: `${type}:${sourceTable}:${sourceId}`,
    event_type: type,
    source_table: sourceTable,
    source_id: sourceId,
    logical_date: date,
    created_at: date + 'T08:00:00Z',
  };
}

describe('days and series', () => {
  it('shifts across a month boundary', () => {
    expect(shiftDay('2026-09-01', -1)).toBe('2026-08-31');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('lists the last n days ending today, ascending', () => {
    expect(lastDays('2026-09-19', 3)).toEqual(['2026-09-17', '2026-09-18', '2026-09-19']);
  });

  it('counts per day and fills gaps with zero', () => {
    const byDay = countByDay(['2026-09-19', '2026-09-19', '2026-09-17']);
    expect(series(lastDays('2026-09-19', 3), byDay)).toEqual([1, 0, 2]);
  });

  it('buckets weeks ending today, oldest first', () => {
    expect(weekBuckets('2026-09-19', 2)).toEqual([
      { start: '2026-09-06', end: '2026-09-12' },
      { start: '2026-09-13', end: '2026-09-19' },
    ]);
  });
});

describe('runs and records', () => {
  it('a day in progress does not break the current run', () => {
    const dates = new Set(['2026-09-17', '2026-09-18']);
    expect(currentRun(dates, '2026-09-19')).toBe(2);
    expect(currentRun(new Set([...dates, '2026-09-19']), '2026-09-19')).toBe(3);
    expect(currentRun(new Set(['2026-09-10']), '2026-09-19')).toBe(0);
  });

  it('finds the longest run and when it ended', () => {
    const dates = new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-11']);
    expect(longestRun(dates)).toEqual({ length: 3, endedOn: '2026-09-03' });
    expect(longestRun(new Set())).toEqual({ length: 0, endedOn: null });
  });

  it('finds the busiest seven days', () => {
    const byDay = countByDay(['2026-09-01', '2026-09-02', '2026-09-02', '2026-09-20']);
    expect(bestWeek(byDay)).toEqual({ count: 3, endedOn: '2026-09-02' });
  });
});

describe('stage progress', () => {
  it('reports the span to the next stage', () => {
    expect(stageProgress(0)).toMatchObject({ current: 'seed', next: 'sprout', into: 0, span: 100, fraction: 0 });
    expect(stageProgress(150)).toMatchObject({ current: 'sprout', next: 'sapling', into: 50, span: 200 });
    expect(stageProgress(5000)).toMatchObject({ current: 'flourishing_tree', next: null, fraction: 1 });
  });
});

describe('achievements', () => {
  it('earns "First step" on the first accepted event and dates it', () => {
    const standings = achievementStandings([event('task_completed', '2026-09-05', 1)]);
    const first = standings.find((row) => row.key === 'first_step')!;
    expect(first.reachedOn).toBe('2026-09-05');
    expect(first.progress).toBe(1);
    const ten = standings.find((row) => row.key === 'ten_true_steps')!;
    expect(ten.reachedOn).toBeNull();
    expect(ten.progress).toBe(1);
    expect(ten.threshold).toBe(10);
  });

  it('dates "Ten true steps" by the tenth accepted event, not the last one', () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      event('task_completed', shiftDay('2026-09-01', i), i + 1),
    );
    const ten = achievementStandings(events).find((row) => row.key === 'ten_true_steps')!;
    expect(ten.reachedOn).toBe('2026-09-10');
    expect(ten.progress).toBe(10);
  });

  it('ignores a duplicated or malformed event key, the same as the points do', () => {
    const dup = event('task_completed', '2026-09-05', 1);
    const bad = { ...event('task_completed', '2026-09-06', 2), event_key: 'wrong' };
    const first = achievementStandings([dup, dup, bad]).find((row) => row.key === 'first_step')!;
    expect(first.progress).toBe(1);
    expect(achievementStandings([dup, dup, bad]).find((row) => row.key === 'ten_true_steps')!.progress).toBe(1);
  });

  it('reaches "New growth" when points cross 100, dated to the crossing event', () => {
    // goal_completed is 50 points; two of them cross the sprout threshold.
    const events = [
      event('goal_completed', '2026-09-01', 1, 'goals'),
      event('goal_completed', '2026-09-08', 2, 'goals'),
      event('goal_completed', '2026-09-15', 3, 'goals'),
    ];
    const growth = achievementStandings(events).find((row) => row.key === 'sprout_stage')!;
    expect(growth.reachedOn).toBe('2026-09-08');
    expect(growth.progress).toBe(100);
  });
});
