'use client';
import { updateLocalTask, type LocalTask } from '@kayamo/offline';
import { useEffect, useRef, useState } from 'react';
import styles from './botanical.module.css';
import { trapDialogTab } from './dialog-keyboard';
import { openDialog, closeDialog } from './dialog-motion';

export function TaskEditor({
  task,
  userId,
  onClose,
  onSaved,
}: {
  task: LocalTask;
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const key = 'kayamo:task-draft:' + userId + ':' + task.id;
  const [draft, setDraft] = useState(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (
        saved &&
        typeof saved === 'object' &&
        'title' in saved &&
        'notes' in saved &&
        typeof saved.title === 'string' &&
        typeof saved.notes === 'string'
      )
        return { title: saved.title, notes: saved.notes };
    } catch {
      /* Keep the confirmed record when a draft is unreadable. */
    }
    return { title: task.title, notes: task.notes ?? '' };
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = draft.title !== task.title || draft.notes !== (task.notes ?? '');
  useEffect(() => {
    openDialog(dialog.current);
  }, []);
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify(draft));
      else sessionStorage.removeItem(key);
    } catch {
      /* Save errors are surfaced by the write itself. */
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [draft, dirty, key]);
  function close() {
    if (busy) return;
    if (dirty && !window.confirm('Discard these unsaved edits?')) return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Optional draft storage. */
    }
    closeDialog(dialog.current, onClose);
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="task-editor-title"
      onKeyDown={trapDialogTab}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2 id="task-editor-title">Your next step</h2>
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current || !draft.title.trim()) return;
          pending.current = true;
          setBusy(true);
          setError(null);
          try {
            const saved = await updateLocalTask({
              id: task.id,
              userId,
              title: draft.title.trim(),
              notes: draft.notes.trim() || null,
            });
            if (!saved) throw new Error('Unavailable');
            try {
              sessionStorage.removeItem(key);
            } catch {
              /* Optional draft storage. */
            }
            await onSaved();
            closeDialog(dialog.current, onClose);
          } catch {
            setError(
              'Could not save your changes. Your draft is still here. Please retry.',
            );
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          Task
          <input
            value={draft.title}
            maxLength={160}
            required
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <label>
          Notes
          <textarea
            rows={6}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </label>
        <p className={styles.muted}>
          Scheduled for {task.scheduled_for ?? 'your inbox'}. Use the full planner to set
          a time or manage dependencies.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}>
          <button
            className={styles.primary}
            type="submit"
            disabled={busy || !draft.title.trim()}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy}
            onClick={close}
          >
            Close
          </button>
        </div>
      </form>
    </dialog>
  );
}
