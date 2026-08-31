import { describe, expect, it } from 'vitest';
import { moveVerifyIndex, sortVerifyRows } from './verify-rows';

describe('sortVerifyRows', () => {
  it('sorts most logged first, then name', () => {
    const rows = [
      { id: 'b', name: 'Kanin' },
      { id: 'a', name: 'Adobo' },
      { id: 'c', name: 'Sinigang' },
    ];
    const counts = new Map([
      ['b', 4],
      ['a', 4],
    ]);
    expect(sortVerifyRows(rows, counts).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('moveVerifyIndex', () => {
  it('wraps j/k around the table', () => {
    expect(moveVerifyIndex(0, 3, -1)).toBe(2);
    expect(moveVerifyIndex(2, 3, 1)).toBe(0);
  });
});
