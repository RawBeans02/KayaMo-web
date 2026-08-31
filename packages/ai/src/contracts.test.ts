import { describe, expect, it } from 'vitest';
import { cocoContextSnapshotSchema, cocoModelOutputSchema, musEntrySchema } from './contracts';

describe('coco model output contracts', () => {
  it('coerces a datetime scheduledFor into a calendar date and dueAt', () => {
    const parsed = cocoModelOutputSchema.safeParse({
      message: 'Want a reminder for the gym later?',
      tone: 'balanced',
      proposals: [
        {
          proposalId: 'proposal-gym-10pm',
          action: 'create_task',
          summary: 'Create a task for a gym session at 10:00 pm today.',
          requiresConfirmation: true,
          arguments: {
            title: 'Go to the gym',
            notes: null,
            scheduledFor: '2026-08-26T22:00:00+08:00',
            dueAt: null,
          },
        },
      ],
      citations: [],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const proposal = parsed.data.proposals[0];
    expect(proposal?.action).toBe('create_task');
    if (proposal?.action !== 'create_task') return;
    expect(proposal.arguments.scheduledFor).toBe('2026-08-26');
    expect(proposal.arguments.dueAt).toBe('2026-08-26T22:00:00+08:00');
  });

  it('accepts optional Mus entry context without replacing the snapshot', () => {
    const entry = musEntrySchema.parse({
      module: 'todos',
      view: 'today',
      selectedIds: ['11111111-1111-4111-8111-111111111111'],
    });
    const parsed = cocoContextSnapshotSchema.safeParse({
      version: 1,
      logicalDate: '2026-09-01',
      timezone: 'Asia/Manila',
      entry,
      recommendedAction: {
        kind: 'task',
        recordId: '11111111-1111-4111-8111-111111111111',
        title: 'Submit form',
      },
      tasks: [],
      routines: [],
      health: {
        mealsLogged: 0,
        weightLogged: false,
        workoutStatus: 'none',
      },
      goals: [],
      memories: [],
      permissions: {
        goals_planning: false,
        physical_self: false,
        memory: false,
        faith: false,
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.entry?.module).toBe('todos');
  });

  it('accepts schedule and gym proposals', () => {
    const parsed = cocoModelOutputSchema.safeParse({
      message: 'Want this on the afternoon block?',
      tone: 'balanced',
      proposals: [
        {
          proposalId: 'p-schedule',
          action: 'schedule_task',
          summary: 'Place submit form at 14:00',
          requiresConfirmation: true,
          arguments: {
            taskId: '11111111-1111-4111-8111-111111111111',
            scheduledFor: '2026-09-01',
            start: '14:00',
            durationMin: 45,
          },
        },
        {
          proposalId: 'p-gym',
          action: 'start_workout',
          summary: 'Start a gym session',
          requiresConfirmation: true,
          arguments: { notes: 'Push' },
        },
      ],
      citations: [],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.proposals.map((row) => row.action)).toEqual(['schedule_task', 'start_workout']);
  });

  it('accepts bulk, recurrence, and catalog gym proposals', () => {
    const parsed = cocoModelOutputSchema.safeParse({
      message: 'Want these catalog edits?',
      tone: 'balanced',
      proposals: [
        {
          proposalId: 'p-bulk',
          action: 'bulk_edit_tasks',
          summary: 'Complete the selected todos',
          requiresConfirmation: true,
          arguments: {
            taskIds: ['11111111-1111-4111-8111-111111111111'],
            scheduledFor: null,
            complete: true,
          },
        },
        {
          proposalId: 'p-recur',
          action: 'set_recurrence',
          summary: 'Repeat submit form weekdays',
          requiresConfirmation: true,
          arguments: {
            taskId: '11111111-1111-4111-8111-111111111111',
            recurrence: 'weekdays',
            intervalDays: 1,
          },
        },
        {
          proposalId: 'p-add',
          action: 'add_session_exercise',
          summary: 'Add barbell squat to the queue',
          requiresConfirmation: true,
          arguments: { slug: 'barbell-squat', targetSets: 3, targetReps: 8 },
        },
      ],
      citations: [],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.proposals.map((row) => row.action)).toEqual([
      'bulk_edit_tasks',
      'set_recurrence',
      'add_session_exercise',
    ]);
  });
});
