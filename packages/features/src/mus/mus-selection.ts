import type { MusEntryModule } from '@kayamo/ai';
import { useEffect, useState } from 'react';

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
