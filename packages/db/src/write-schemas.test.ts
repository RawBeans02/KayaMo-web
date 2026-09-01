import { describe, expect, it } from 'vitest';
import {
  parseRoutineTitle,
  parseScheduleDays,
  parseTaskTitle,
  scheduleDaysSchema,
} from './write-schemas';

describe('shared write schemas', () => {
  it('rejects empty and overlong task titles', () => {
    expect(() => parseTaskTitle('  ')).toThrow();
    expect(() => parseTaskTitle('x'.repeat(161))).toThrow();
    expect(parseTaskTitle('  Submit form  ')).toBe('Submit form');
  });

  it('requires a non-empty 0–6 weekday set for routines', () => {
    expect(parseScheduleDays([6])).toEqual([6]);
    expect(parseScheduleDays([5, 0, 0, 6])).toEqual([0, 5, 6]);
    expect(scheduleDaysSchema.safeParse([]).success).toBe(false);
    expect(scheduleDaysSchema.safeParse([7]).success).toBe(false);
    expect(() => parseRoutineTitle('')).toThrow();
  });
});
