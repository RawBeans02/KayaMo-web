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

export function sessionElapsedSeconds(startedAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(startedAt)) / 1000));
}

export function sessionElapsedMinutes(startedAt: string, nowMs: number): number {
  return Math.floor(sessionElapsedSeconds(startedAt, nowMs) / 60);
}

export function sessionElapsedLabel(startedAt: string, nowMs: number): string {
  return `${sessionElapsedMinutes(startedAt, nowMs)} min elapsed`;
}

/** How much of the current rest window has already elapsed (0–100). */
export function restElapsedPct(
  timer: Pick<LocalRestTimer, 'started_at'>,
  remainingSeconds: number,
  nowMs: number,
): number {
  const elapsed = Math.max(0, (nowMs - Date.parse(timer.started_at)) / 1000);
  const total = Math.max(1, elapsed + remainingSeconds);
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}
