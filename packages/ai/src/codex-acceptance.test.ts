import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cocoActionNameSchema, cocoContextSnapshotSchema, musEntrySchema } from './contracts';

const here = dirname(fileURLToPath(import.meta.url));

describe('codex acceptance: prompt and shared Mus', () => {
  it('keeps the Coco system string and confirmation rules', () => {
    const src = readFileSync(join(here, 'openai-provider.ts'), 'utf8');
    expect(src).toContain("You are Coco, KayaMo's supportive AI companion.");
    expect(src).toContain('Propose at most three actions and set requiresConfirmation to true');
    expect(src).toContain('Do not claim an action was executed');
    expect(src).toContain('Nutrition calculation is outside your authority');
    expect(src).not.toMatch(/system:\s*`You are Mus/);
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
