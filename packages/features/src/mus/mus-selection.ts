import type { MusEntryModule } from '@kayamo/ai';
import { useEffect, useState } from 'react';
import type { MusFace } from './mus-faces';

export type MusSelection = {
  module: MusEntryModule;
  view: string | null;
  selectedIds: string[];
  label: string;
};

type Listener = (next: MusSelection | null) => void;

let current: MusSelection | null = null;
const listeners = new Set<Listener>();

export function publishMusSelection(next: MusSelection | null): void {
  current = next;
  for (const listener of listeners) listener(next);
}

export function subscribeMusSelection(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function useMusSelection(): MusSelection | null {
  const [selection, setSelection] = useState<MusSelection | null>(current);
  useEffect(() => subscribeMusSelection(setSelection), []);
  return selection;
}

export const MUS_BUSY_EVENT = 'kayamo:mus-busy';

export function setMusBusy(busy: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MUS_BUSY_EVENT, { detail: { busy } }));
}

export function useMusBusy(): boolean {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    function onBusy(event: Event) {
      const detail = (event as CustomEvent<{ busy?: boolean }>).detail;
      setBusy(detail?.busy === true);
    }
    window.addEventListener(MUS_BUSY_EVENT, onBusy);
    return () => window.removeEventListener(MUS_BUSY_EVENT, onBusy);
  }, []);
  return busy;
}

/**
 * The resting face, published by the thread after each reply and read by every
 * LisFace on the page. Held in module state as well as broadcast, so a face that
 * mounts after the reply (the rail on a later screen) shows the same expression
 * rather than snapping back to neutral. "thinking" is not published here: it is
 * derived from the busy flag while a reply is in flight.
 */
export const MUS_FACE_EVENT = 'kayamo:mus-face';

let currentFace: MusFace = 'neutral';

export function setMusFace(face: MusFace): void {
  currentFace = face;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MUS_FACE_EVENT, { detail: { face } }));
}

export function useMusFace(): MusFace {
  const [face, setFace] = useState<MusFace>(currentFace);
  useEffect(() => {
    setFace(currentFace);
    function onFace(event: Event) {
      const detail = (event as CustomEvent<{ face?: MusFace }>).detail;
      if (detail?.face) setFace(detail.face);
    }
    window.addEventListener(MUS_FACE_EVENT, onFace);
    return () => window.removeEventListener(MUS_FACE_EVENT, onFace);
  }, []);
  return face;
}
