import { describe, expect, it } from 'vitest';
import { actionLabel, previewMusProposal } from './proposal-preview';

describe('proposal preview', () => {
  it('humanizes action names', () => {
    expect(actionLabel('create_task')).toBe('create task');
    expect(actionLabel('move_time_block')).toBe('move time block');
  });

  it('shows the after state for a new task without touching Dexie', async () => {
    const diff = await previewMusProposal('user-a', {
      proposalId: 'p1',
      action: 'create_task',
      summary: 'Add lesson plan',
      requiresConfirmation: true,
      arguments: {
        title: 'Lesson plan',
        notes: null,
        scheduledFor: '2026-09-01',
        dueAt: null,
      },
    });
    expect(diff.before).toBeNull();
    expect(diff.after).toBe('Lesson plan · 2026-09-01');
  });
});
