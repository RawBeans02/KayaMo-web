import { describe, expect, it } from 'vitest';
import { horizonToScheduledFor, planKind, planSourceTable } from './apply-plan';

describe('plan apply helpers', () => {
  it('maps horizons without dumping someday onto today', () => {
    expect(horizonToScheduledFor('2026-09-01', 'TODAY')).toBe('2026-09-01');
    expect(horizonToScheduledFor('2026-09-01', 'TOMORROW')).toBe('2026-09-02');
    expect(horizonToScheduledFor('2026-09-01', 'SOMEDAY')).toBeNull();
  });

  it('keeps only task source ids on the local timetable', () => {
    expect(planSourceTable('tasks')).toBe('tasks');
    expect(planSourceTable('events')).toBe('none');
    expect(planKind('MEAL_BLOCK')).toBe('MEAL');
    expect(planKind('EVENT')).toBe('EVENT');
  });
});
