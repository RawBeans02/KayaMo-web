import { describe, expect, it } from 'vitest';
import {
  DRAG_THRESHOLD_PX,
  projectVelocity,
  rubberband,
  snappedRange,
  springValue,
} from './timeline-physics';

describe('bounded timeline motion', () => {
  it('requires deliberate movement and caps momentum at one snap', () => {
    expect(DRAG_THRESHOLD_PX).toBe(10);
    expect(projectVelocity(10000, 15)).toBe(15);
    expect(projectVelocity(-10000, 15)).toBe(-15);
    expect(projectVelocity(0, 15)).toBe(0);
  });
  it('tracks in bounds exactly and resists beyond either edge', () => {
    expect(rubberband(600, 420, 1260, 280)).toBe(600);
    expect(rubberband(400, 420, 1260, 280)).toBeGreaterThan(400);
    expect(rubberband(400, 420, 1260, 280)).toBeLessThan(420);
    expect(rubberband(1300, 420, 1260, 280)).toBeLessThan(1300);
    expect(rubberband(1300, 420, 1260, 280)).toBeGreaterThan(1260);
  });
  it('commits valid snapped ranges, even with non-grid day bounds', () => {
    expect(snappedRange({ start: 400, end: 460 }, 'move', 427, 1313)).toEqual({
      start: 427,
      end: 487,
    });
    expect(snappedRange({ start: 1340, end: 1400 }, 'move', 427, 1313)).toEqual({
      start: 1253,
      end: 1313,
    });
    expect(snappedRange({ start: 540, end: 544 }, 'resize', 420, 1320)).toEqual({
      start: 540,
      end: 555,
    });
    expect(snappedRange({ start: 540, end: 1500 }, 'resize', 420, 1320)).toEqual({
      start: 540,
      end: 1320,
    });
  });
  it('starts at the current visual position and converges without default bounce', () => {
    expect(springValue(600, 660, 0, 0)).toBe(600);
    let previous = 600;
    for (let frame = 1; frame <= 60; frame++) {
      const current = springValue(600, 660, 0, frame / 60);
      expect(current).toBeGreaterThanOrEqual(previous);
      expect(current).toBeLessThanOrEqual(660);
      previous = current;
    }
    expect(previous).toBeCloseTo(660, 3);
    const interrupted = springValue(600, 660, 0, 0.1);
    expect(springValue(interrupted, 580, 0, 0)).toBe(interrupted);
  });
});
