import type { LocalRestTimer } from '@kayamo/offline';

export function restRemainingSeconds(timer: Pick<LocalRestTimer, 'ends_at'>, nowMs: number): number {
  return Math.max(0, Math.round((Date.parse(timer.ends_at) - nowMs) / 1000));
}

export function formatRestClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Design rest bar turns attention-orange under 15s. */
export function restIsUrgent(secondsLeft: number): boolean {
  return secondsLeft > 0 && secondsLeft <= 15;
}

export function sessionElapsedMinutes(startedAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(startedAt)) / 60_000));
}

export function sessionElapsedLabel(startedAt: string, nowMs: number): string {
  return `${sessionElapsedMinutes(startedAt, nowMs)} min elapsed`;
}
