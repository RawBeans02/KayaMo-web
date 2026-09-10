import { describe, expect, it } from 'vitest';
import {
  formatRestClock,
  restElapsedPct,
  restIsUrgent,
  restRemainingSeconds,
  sessionElapsedMinutes,
  sessionElapsedSeconds,
} from './session-clock';

describe('gym session clock', () => {
  const timer = { ends_at: '2026-09-02T04:00:30.000Z' };

  it('derives remaining rest from ends_at, so leaving the gym screen cannot reset it', () => {
    const now = Date.parse('2026-09-02T04:00:10.000Z');
    expect(restRemainingSeconds(timer, now)).toBe(20);
    expect(restRemainingSeconds(timer, now + 5_000)).toBe(15);
    expect(restIsUrgent(15)).toBe(true);
    expect(restIsUrgent(16)).toBe(false);
    expect(formatRestClock(75)).toBe('1:15');
  });

  it('keeps session elapsed on the workout start instant, not on which screen is mounted', () => {
    const started = '2026-09-02T03:10:00.000Z';
    const later = Date.parse('2026-09-02T03:22:00.000Z');
    expect(sessionElapsedMinutes(started, later)).toBe(12);
    expect(sessionElapsedSeconds(started, later)).toBe(12 * 60);
  });

  it('fills the rest track from elapsed time, not from which screen is mounted', () => {
    const running = { started_at: '2026-09-02T04:00:00.000Z' };
    const now = Date.parse('2026-09-02T04:00:30.000Z');
    expect(restElapsedPct(running, 60, now)).toBeCloseTo(33.33, 1);
    expect(restElapsedPct(running, 0, now)).toBe(100);
  });
});
