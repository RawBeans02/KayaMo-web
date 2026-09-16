import { describe, expect, it } from 'vitest';
import { clampCocoContext } from './context-gateway';
import { CONTEXT_LIMITS, truncateWords } from './context-limits';
import { cocoContextSnapshotSchema, type CocoContextSnapshot } from './contracts';

function snapshot(overrides: Partial<CocoContextSnapshot> = {}): CocoContextSnapshot {
  return {
    version: 1,
    logicalDate: '2026-08-22',
    timezone: 'Asia/Manila',
    recommendedAction: { kind: 'check_in', recordId: null, title: 'Choose what would help next' },
    tasks: [],
    routines: [],
    goals: [],
    health: { mealsLogged: 0, weightLogged: false, workoutStatus: 'none' },
    memories: [],
    permissions: { goals_planning: true, physical_self: true, memory: true, faith: false, identity: false },
    ...overrides,
  };
}

const memory = (n: number) => ({ id: `m-${n}`, kind: 'context', content: `memory ${n}` });

describe('clampCocoContext', () => {
  /**
   * The regression this exists for: no loader applied a limit while the schema
   * enforced one, so a user's twenty-first memory threw an unhandled ZodError
   * inside routeCoco and returned a 500 for every subsequent request.
   */
  it('keeps an oversized snapshot parseable instead of throwing', () => {
    const over = snapshot({
      memories: Array.from({ length: 40 }, (_, i) => memory(i)),
      tasks: Array.from({ length: 80 }, (_, i) => ({
        id: `t-${i}`, title: `task ${i}`, completed: false, dueAt: null,
      })),
    });
    expect(() => cocoContextSnapshotSchema.parse(over)).toThrow();

    const { context, truncated } = clampCocoContext(over);
    expect(() => cocoContextSnapshotSchema.parse(context)).not.toThrow();
    expect(context.memories).toHaveLength(CONTEXT_LIMITS.memories);
    expect(context.tasks).toHaveLength(CONTEXT_LIMITS.tasks);
    expect(truncated).toContain('memory');
    expect(truncated).toContain('goals_planning');
  });

  it('reports nothing truncated when the snapshot already fits', () => {
    const { context, truncated } = clampCocoContext(snapshot({ memories: [memory(1)] }));
    expect(truncated).toEqual([]);
    expect(context.memories).toHaveLength(1);
  });

  it('cuts long memory content so history cannot crowd out the reply', () => {
    const long = 'word '.repeat(200).trim();
    const { context } = clampCocoContext(
      snapshot({ memories: [{ id: 'm-1', kind: 'context', content: long }] }),
    );
    expect(context.memories[0]!.content.length).toBeLessThanOrEqual(
      CONTEXT_LIMITS.memoryContentChars + 1,
    );
  });

  it('leaves an absent optional collection absent', () => {
    const { context } = clampCocoContext(snapshot());
    expect(context.scripture).toBeUndefined();
    expect(context.health.confirmedWorkouts).toBeUndefined();
  });
});

describe('truncateWords', () => {
  it('returns short input untouched', () => {
    expect(truncateWords('short', 240)).toBe('short');
  });

  it('cuts on a word boundary rather than mid-word', () => {
    expect(truncateWords('alpha bravo charlie delta', 16)).toBe('alpha bravo…');
  });
});
