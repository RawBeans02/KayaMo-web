export type DragRange = { start: number; end: number };
export const DRAG_THRESHOLD_PX = 10;
export function rubberband(value: number, min: number, max: number, dimension: number) {
  const bound = Math.max(min, Math.min(max, value));
  const excess = value - bound;
  const size = Math.max(1, dimension);
  return bound + (excess * size * 0.55) / (size + 0.55 * Math.abs(excess));
}
export function projectVelocity(velocity: number, cap: number) {
  const projected = ((velocity / 1000) * 0.998) / (1 - 0.998);
  return Math.max(-cap, Math.min(cap, projected));
}
/** Closed-form critically damped spring; frame-rate independent, no overshoot preset. */
export function springValue(from: number, to: number, velocity: number, seconds: number) {
  const frequency = 24;
  const displacement = from - to;
  return (
    to +
    (displacement + (velocity + frequency * displacement) * seconds) *
      Math.exp(-frequency * seconds)
  );
}
export function snappedRange(
  range: DragRange,
  mode: 'move' | 'resize',
  dayStart: number,
  dayEnd: number,
) {
  const snap = (value: number) => Math.round(value / 15) * 15;
  if (mode === 'resize')
    return {
      start: range.start,
      end: Math.max(range.start + 15, Math.min(dayEnd, snap(range.end))),
    };
  const duration = range.end - range.start;
  const start = Math.max(dayStart, Math.min(dayEnd - duration, snap(range.start)));
  return { start, end: start + duration };
}
