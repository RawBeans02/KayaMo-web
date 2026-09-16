import { describe, expect, it } from 'vitest';
import { cocoActionNameSchema, cocoContextSnapshotSchema, musEntrySchema } from './contracts';
import { renderLisSystemPrompt } from './persona';
import { baselineContext } from './evals/doubles';

/**
 * This used to `readFileSync('openai-provider.ts')` and assert on source
 * substrings, which was brittle in the wrong direction: it broke whenever the
 * file was refactored while permitting any semantic change that kept those
 * substrings intact. It now asserts on what the model is actually sent.
 */
describe('codex acceptance: prompt and shared Lis', () => {
  it('keeps the non-negotiable clauses in the assembled prompt', () => {
    const prompt = renderLisSystemPrompt(baselineContext());
    expect(prompt).toContain("You are Lis, KayaMo's supportive AI companion.");
    expect(prompt).not.toMatch(/\b(?:Mus|Coco)\b/);
    expect(prompt).toContain('Propose at most three actions and set requiresConfirmation to true');
    expect(prompt).toContain('Do not claim an action was executed');
    expect(prompt).toContain('Nutrition calculation is outside your authority');
    expect(prompt).toContain('Faith content is opt-in');
    expect(prompt).toContain('Never invent completed activity');
  });

  it('treats module entry as extra JSON, not a replaced prompt file', () => {
    const snapshot = cocoContextSnapshotSchema.parse({
      version: 1,
      logicalDate: '2026-09-01',
      timezone: 'Asia/Manila',
      entry: musEntrySchema.parse({
        module: 'gym',
        view: 'session',
        selectedIds: ['squat-item'],
      }),
      recommendedAction: {
        kind: 'task',
        recordId: '11111111-1111-4111-8111-111111111111',
        title: 'Train',
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
        identity: false,
      },
    });
    expect(snapshot.entry?.module).toBe('gym');
    expect(cocoActionNameSchema.options).toEqual(
      expect.arrayContaining([
        'create_task',
        'start_workout',
        'bulk_edit_tasks',
        'set_recurrence',
        'add_session_exercise',
        'log_food',
      ]),
    );
  });
});
