import {
  DRAG_THRESHOLD_PX,
  projectVelocity,
  rubberband,
  snappedRange,
  springValue,
  type DragRange,
} from './timeline-physics';

type Options = {
  target: HTMLElement;
  pointerId: number;
  originY: number;
  origin: DragRange;
  mode: 'move' | 'resize';
  dayStart: number;
  dayEnd: number;
  hourPx: number;
  preview: (range: DragRange) => void;
  commit: (range: DragRange) => void | Promise<void>;
  cancel: () => void;
};
/** Pointer-only, web-opt-in controller. Keyboard and persisted schedule rules stay separate. */
export function startTimelineDrag(options: Options): () => void {
  const { target, pointerId, originY, origin, mode, dayStart, dayEnd, hourPx } = options;
  const gentle = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pxToMin = 60 / hourPx;
  const duration = origin.end - origin.start;
  let latest = origin;
  let active = false;
  let stopped = false;
  let frame = 0;
  let samples = [{ y: originY, time: performance.now() }];
  const block = target.parentElement;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  target.setPointerCapture(pointerId);

  function clean() {
    cancelAnimationFrame(frame);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', cancel);
    target.removeEventListener('lostpointercapture', lost);
    media.removeEventListener('change', cancel);
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    if (block) {
      block.style.willChange = '';
      delete block.dataset.dragging;
    }
  }
  function cancel() {
    if (stopped) return;
    stopped = true;
    clean();
    options.cancel();
  }
  function lost() {
    cancel();
  }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId || stopped) return;
    const pixels = event.clientY - originY;
    if (!active && Math.abs(pixels) < DRAG_THRESHOLD_PX) return;
    active = true;
    if (block) {
      block.style.willChange = mode === 'move' ? 'transform' : '';
      block.dataset.dragging = 'true';
    }
    event.preventDefault();
    const time = performance.now();
    samples = [
      ...samples.filter((sample) => time - sample.time <= 80),
      { y: event.clientY, time },
    ];
    const delta = pixels * pxToMin;
    if (mode === 'move') {
      const start = rubberband(
        origin.start + delta,
        dayStart,
        dayEnd - duration,
        (dayEnd - dayStart) / 3,
      );
      latest = { start, end: start + duration };
    } else {
      latest = {
        start: origin.start,
        end: rubberband(
          origin.end + delta,
          origin.start + 15,
          dayEnd,
          (dayEnd - dayStart) / 3,
        ),
      };
    }
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        options.preview(latest);
      });
  }
  function up(event: PointerEvent) {
    if (event.pointerId !== pointerId || stopped) return;
    clean();
    if (!active) {
      stopped = true;
      options.cancel();
      return;
    }
    const time = performance.now();
    const first = samples[0];
    const last = samples[samples.length - 1];
    const velocityPx =
      first && last && last.time > first.time && time - last.time < 80
        ? ((last.y - first.y) / (last.time - first.time)) * 1000
        : 0;
    // Scheduling is precision work: momentum is capped at ONE 15-minute snap.
    // Resize and reduced-motion interactions do not project past the released point.
    const velocity = !gentle && mode === 'move' ? velocityPx * pxToMin : 0;
    const travel = projectVelocity(velocity, 15);
    const destination = snappedRange(
      mode === 'move'
        ? { start: latest.start + travel, end: latest.end + travel }
        : latest,
      mode,
      dayStart,
      dayEnd,
    );
    if (gentle) {
      stopped = true;
      options.preview(destination);
      void Promise.resolve(options.commit(destination)).catch(() => options.cancel());
      return;
    }
    const from = latest;
    const began = performance.now();
    if (block) {
      block.style.willChange = mode === 'move' ? 'transform' : '';
      block.dataset.dragging = 'settling';
    }
    function tick(now: number) {
      if (stopped) return;
      const seconds = (now - began) / 1000;
      if (seconds >= 0.4) {
        stopped = true;
        clean();
        options.preview(destination);
        void Promise.resolve(options.commit(destination)).catch(() => options.cancel());
        return;
      }
      const boundedVelocity = Math.max(-180, Math.min(180, velocity));
      options.preview({
        start:
          mode === 'move'
            ? springValue(from.start, destination.start, boundedVelocity, seconds)
            : from.start,
        end: springValue(from.end, destination.end, boundedVelocity, seconds),
      });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    media.addEventListener('change', cancel);
  }
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('lostpointercapture', lost);
  media.addEventListener('change', cancel);
  return cancel;
}
