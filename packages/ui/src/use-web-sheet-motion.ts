'use client';
import { useLayoutEffect, useRef, useState } from 'react';

/** Web-only presence; mobile keeps its existing immediate mount/unmount behavior. */
export function useWebSheetMotion(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const [present, setPresent] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (
      !element ||
      !document.documentElement.hasAttribute('data-kayamo-web') ||
      typeof element.animate !== 'function'
    )
      return;
    const gentle = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const current = getComputedStyle(element);
    const previous = animation.current;
    const opacity = current.opacity;
    const transform = current.transform;
    previous?.cancel();
    if (open) setPresent(true);
    const trigger = document.activeElement;
    if (open && trigger instanceof HTMLElement && !element.contains(trigger)) {
      const anchor = trigger.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      element.style.transformOrigin = `${Math.max(0, Math.min(bounds.width, anchor.x + anchor.width / 2 - bounds.x))}px bottom`;
    }
    const rest = gentle ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0)' };
    const away = gentle ? { opacity: 0 } : { opacity: 0, transform: 'translateY(12px)' };
    const from = previous
      ? gentle
        ? { opacity }
        : { opacity, transform }
      : open
        ? away
        : rest;
    element.style.willChange = gentle ? 'opacity' : 'transform, opacity';
    const next = element.animate([from, open ? rest : away], {
      duration: gentle
        ? 150
        : open
          ? parseFloat(current.getPropertyValue('--duration-sheet')) || 280
          : 180,
      easing: open ? 'cubic-bezier(0.2, 0.8, 0.2, 1)' : 'cubic-bezier(0.8, 0, 0.8, 0.2)',
    });
    animation.current = next;
    void next.finished
      .then(() => {
        if (animation.current !== next) return;
        animation.current = null;
        element.style.willChange = '';
        if (!open) setPresent(false);
      })
      .catch(() => undefined);
    // The next run reads current presentation before cancelling, so interruption
    // continues from the current frame rather than restarting from an endpoint.
  }, [open]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
  return { ref, visible: open || present };
}
