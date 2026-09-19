'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * A reading that counts up to its value the first time it appears, the way a
 * platform counter settles, and jumps straight to later values so a refresh
 * never replays the roll. Honours Reduce Motion by returning the value at once.
 * Integers only; the callers format the result.
 */
export function useCountUp(target: number, duration = 520): number {
  const [shown, setShown] = useState(target);
  const rolled = useRef(false);
  useEffect(() => {
    if (rolled.current || target <= 0) {
      setShown(target);
      rolled.current = rolled.current || target > 0;
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target);
      rolled.current = true;
      return;
    }
    rolled.current = true;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}
