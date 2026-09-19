'use client';

import { BotanicalIcon } from '@kayamo/features/desktop';
import { createLocalTask } from '@kayamo/offline';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import styles from './glass-shell.module.css';

export const OPEN_SHEET_EVENT = 'kayamo:open-log-sheet';

export type LogKind = 'task' | 'meal';

const KINDS: Array<{
  id: LogKind;
  label: string;
  placeholder: string;
  chips: string[];
}> = [
  {
    id: 'task',
    label: 'Task',
    placeholder: 'What needs doing?',
    chips: ['Call back', 'Read one chapter', 'Tidy desk'],
  },
  {
    id: 'meal',
    label: 'Meal',
    placeholder: 'What did you eat?',
    chips: ['Coffee', 'Rice bowl', 'Salad'],
  },
];

export function openLogSheet(kind: LogKind = 'task'): void {
  window.dispatchEvent(new CustomEvent(OPEN_SHEET_EVENT, { detail: kind }));
}

/**
 * The one create surface, reachable from anywhere: the `+` in the phone tab bar
 * and the Log button in the desktop header.
 *
 * Task writes straight to the local planner. Meal hands off to the food
 * palette, which owns catalog resolution — the sheet is a router with a text
 * field, not a second food logger. A Workout kind opened the Gym desk until
 * 2026-09-19; Gym is off the v1 rail, so the sheet no longer offers it.
 */
export function LogSheet({
  userId,
  open,
  onOpenChange,
  onToast,
  onMeal,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToast: (text: string, undo?: () => void) => void;
  onMeal: (draft: string) => void;
}) {
  const [kind, setKind] = useState<LogKind>('task');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The sheet leaves the way it came: closing keeps it mounted for the exit
  // animation, then the parent is told it is closed.
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<LogKind>).detail;
      setKind(detail ?? 'task');
      setDraft('');
      setError(null);
      onOpenChange(true);
    }
    window.addEventListener(OPEN_SHEET_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SHEET_EVENT, onOpen);
  }, [onOpenChange]);

  // Focus lands after the sheet finishes travelling, not during.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 320);
    return () => window.clearTimeout(timer);
  }, [open]);

  const leave = useCallback(() => {
    if (closing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onOpenChange(false);
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onOpenChange(false);
    }, 200);
  }, [closing, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        leave();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, leave]);

  if (!open) return null;

  const active = KINDS.find((k) => k.id === kind) ?? KINDS[0]!;
  const index = KINDS.indexOf(active);
  const canAdd = draft.trim().length > 0 && !busy;

  function close() {
    setDraft('');
    setError(null);
    leave();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    if (kind === 'meal') {
      close();
      onMeal(text);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const task = await createLocalTask({ userId, title: text });
      close();
      onToast('Added to plan', () => {
        void import('@kayamo/offline').then((m) =>
          m.tombstoneLocalTask({ id: task.id, userId }),
        );
      });
    } catch {
      setError('Could not save that. Your other entries are untouched.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.scrim}
        data-closing={closing ? 'true' : undefined}
        aria-label="Close"
        onClick={close}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Log"
        className={`${styles.sheet} kgHeavy`}
        data-closing={closing ? 'true' : undefined}
      >
        <div className={styles.grabber} aria-hidden="true" />

        <div role="tablist" aria-label="What to log" className={styles.segmented}>
          <div
            className={styles.segIndicator}
            aria-hidden="true"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={k.id === kind}
              className={styles.seg}
              onClick={() => {
                setKind(k.id);
                setError(null);
              }}
            >
              {k.label}
            </button>
          ))}
        </div>

        <form className={styles.sheetForm} onSubmit={(e) => void submit(e)}>
          <label htmlFor={fieldId} className="sr-only">
            {active.label}
          </label>
          <input
            id={fieldId}
            ref={inputRef}
            className="kgField"
            placeholder={active.placeholder}
            value={draft}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
          />

          <div className={styles.chips}>
            {active.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className={styles.chip}
                onClick={() => setDraft(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" style={{ margin: 0, color: 'var(--danger-text)', fontSize: 14 }}>
              {error}
            </p>
          ) : null}

          <button type="submit" className="kgAccent" disabled={!canAdd}>
            {kind === 'task' ? (busy ? 'Adding…' : 'Add task') : 'Find this food'}
          </button>
          <button type="button" className={styles.sheetCancel} onClick={close}>
            Cancel
          </button>
        </form>
      </section>
    </>
  );
}

export function GlassToast({
  text,
  onUndo,
  onDone,
}: {
  text: string;
  onUndo?: () => void;
  onDone: () => void;
}) {
  // Each toast is its own mount (the shell keys it by text), so `leaving`
  // starts false for every new one without a reset inside the effect.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), 3960);
    const timer = window.setTimeout(onDone, 4200);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(timer);
    };
  }, [text, onDone]);

  return (
    <div
      role="status"
      className={`${styles.toast} kgPanelStrong kgFloat`}
      data-leaving={leaving ? 'true' : undefined}
    >
      <span style={{ color: 'var(--accent-text)', display: 'grid' }}>
        <BotanicalIcon name="checkCircle" size={20} weight="fill" />
      </span>
      <span className={styles.toastText}>{text}</span>
      {onUndo ? (
        <button
          type="button"
          className={styles.toastUndo}
          onClick={() => {
            onUndo();
            onDone();
          }}
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}
