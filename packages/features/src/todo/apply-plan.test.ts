import { describe, expect, it } from 'vitest';
import { captureDisposition, dayPlanProposalId, horizonToScheduledFor } from './apply-plan';
import type { CaptureProposal, DayPlanProposal } from './planner-schema';

const baseItem = {
  dueHint: null,
  preferredWindow: null,
  durationMin: 30,
  location: null,
  category: null,
  constraint: null,
  confidence: 0.9,
} satisfies Partial<CaptureProposal['items'][number]>;

describe('captureDisposition', () => {
  it('keeps Sunday routines instead of inventing weekdays', () => {
    const result = captureDisposition(
      {
        ...baseItem,
        kind: 'ROUTINE',
        title: 'Gym',
        scheduleDays: [0],
        preferredTime: '07:00',
        timing: 'exact',
      },
      '2026-09-01',
    );
    expect(result).toEqual({
      write: 'routine',
      scheduleDays: [0],
      preferredTime: '07:00',
    });
  });

  it('parks uncertain tasks in inbox instead of defaulting to today', () => {
    expect(
      captureDisposition(
        {
          ...baseItem,
          kind: 'TASK',
          title: 'Call mama',
          timing: 'vague',
        },
        '2026-09-01',
      ),
    ).toEqual({ write: 'task', scheduledFor: null });
  });

  it('does not invent an event clock time', () => {
    expect(
      captureDisposition(
        {
          ...baseItem,
          kind: 'EVENT',
          title: 'Dinner',
          timing: 'unknown',
        },
        '2026-09-01',
      ),
    ).toEqual({ write: 'task', scheduledFor: null });
  });

  it('uses an explicit scheduled date for tasks', () => {
    expect(
      captureDisposition(
        {
          ...baseItem,
          kind: 'TASK',
          title: 'Submit form',
          scheduledFor: '2026-09-04',
          timing: 'exact',
        },
        '2026-09-01',
      ),
    ).toEqual({ write: 'task', scheduledFor: '2026-09-04' });
  });
});

describe('dayPlanProposalId', () => {
  const plan = {
    logicalDate: '2026-09-01',
    mode: 'standard',
    overload: false,
    usableOpenMinutes: 120,
    summary: 'Protect the gym, then write.',
    blocks: [
      {
        kind: 'TASK',
        title: 'Write',
        start: '09:00',
        end: '10:00',
        flexibility: 'FLEXIBLE',
        sourceTable: 'tasks',
        sourceId: null,
        durationMin: 60,
        why: 'Deep work',
      },
    ],
    deferrals: [],
    questions: [],
  } satisfies DayPlanProposal;

  it('is stable for the same plan and honors proposalId', () => {
    expect(dayPlanProposalId(plan)).toBe(dayPlanProposalId(plan));
    expect(dayPlanProposalId({ ...plan, proposalId: 'plan-abc12345' })).toBe('plan-abc12345');
  });
});

describe('horizonToScheduledFor', () => {
  it('maps named horizons without inventing someday dates', () => {
    expect(horizonToScheduledFor('2026-09-01', 'TODAY')).toBe('2026-09-01');
    expect(horizonToScheduledFor('2026-09-01', 'TOMORROW')).toBe('2026-09-02');
    expect(horizonToScheduledFor('2026-09-01', 'SOMEDAY')).toBeNull();
  });
});
