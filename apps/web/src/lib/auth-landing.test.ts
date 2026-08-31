import { authCallbackNextPath } from '@kayamo/features/auth';
import { describe, expect, it } from 'vitest';

describe('desktop auth landing', () => {
  it('defaults next to today', () => {
    expect(authCallbackNextPath(null, '/today')).toBe('/today');
  });
});
