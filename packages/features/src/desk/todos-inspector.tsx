'use client';

import {
  DEFAULT_TASK_META,
  upsertLocalTaskMeta,
  updateLocalTask,
  updateLocalTimeBlock,
  type LocalPlanningProject,
  type LocalTask,
  type LocalTaskMeta,
  type LocalTimeBlock,
  type RecurrenceKind,
  type ScheduleFlexibility,
} from '@kayamo/offline';
import { useEffect, useRef, useState } from 'react';
import styles from '../food/desk.module.css';
import { labelToMinutes, minutesToLabel } from '../todo/timetable';

const FLEX: ScheduleFlexibility[] = ['FIXED', 'FLEXIBLE', 'AUTO', 'ANYTIME', 'PROTECTED'];
const RECUR: RecurrenceKind[] = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'after_completion'];

export function TodosInspector({
  userId,
  task,
  block,
  meta,
  projects,
  blocked,
  onChange,
  onToggle,
  onPlace,
  onMoveToday,
  onMoveTomorrow,
  onMoveInbox,
  onDelete,
}: {
  userId: string;
  task: LocalTask | null;
  block: LocalTimeBlock | null;
  meta: LocalTaskMeta | null;
  projects: LocalPlanningProject[];
  blocked: boolean;
  onChange: () => Promise<void>;
  onToggle?: () => void;
  onPlace?: () => void;
  onMoveToday?: () => void;
  onMoveTomorrow?: () => void;
  onMoveInbox?: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? block?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? block?.notes ?? '');
  const [flexibility, setFlexibility] = useState<ScheduleFlexibility>(
    meta?.flexibility ?? block?.flexibility ?? 'FLEXIBLE',
  );
  const [locked, setLocked] = useState(meta?.locked ?? block?.locked ?? false);
  const [duration, setDuration] = useState(String(meta?.estimated_duration_min ?? 30));
  const [recurrence, setRecurrence] = useState<RecurrenceKind>(meta?.recurrence ?? 'none');
  const [energy, setEnergy] = useState(meta?.energy ?? '');
  const [location, setLocation] = useState(meta?.location ?? '');
  const [projectId, setProjectId] = useState(meta?.project_id ?? '');
  const [start, setStart] = useState(block ? minutesToLabel(block.start_min) : '');
  const [end, setEnd] = useState(block ? minutesToLabel(block.end_min) : '');
  const [saving, setSaving] = useState(false);

  const dirty = useRef(false);
  const selectedKey = useRef('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const key = `${task?.id ?? ''}:${block?.id ?? ''}`;
    if (selectedKey.current === key && dirty.current) return;
    selectedKey.current = key;
    dirty.current = false;
    setSaveError(null);
    setTitle(task?.title ?? block?.title ?? '');
    setNotes(task?.notes ?? block?.notes ?? '');
    setFlexibility(meta?.flexibility ?? block?.flexibility ?? 'FLEXIBLE');
    setLocked(meta?.locked ?? block?.locked ?? false);
    setDuration(String(meta?.estimated_duration_min ?? DEFAULT_TASK_META.estimated_duration_min));
    setRecurrence(meta?.recurrence ?? 'none');
    setEnergy(meta?.energy ?? '');
    setLocation(meta?.location ?? '');
    setProjectId(meta?.project_id ?? '');
    setStart(block ? minutesToLabel(block.start_min) : '');
    setEnd(block ? minutesToLabel(block.end_min) : '');
  }, [block, meta, task]);

  if (!task && !block) {
    return (
      <div className={styles.inspectCard}>
        <div className={styles.inspectHead}>
          <p className={styles.inspectEyebrow}>Inspector</p>
          <p className={styles.inspectTitle}>Nothing selected</p>
        </div>
        <div className={styles.inspectBody}>
          <p className={styles.inspectNote}>Select a task or a block to inspect it.</p>
        </div>
      </div>
    );
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      if (task) {
        await updateLocalTask({
          id: task.id,
          userId,
          title: title.trim() || task.title,
          notes: notes.trim() ? notes : null,
        });
        await upsertLocalTaskMeta({
          taskId: task.id,
          userId,
          flexibility,
          locked,
          estimated_duration_min: Math.max(5, Number(duration) || 30),
          recurrence,
          energy: energy === 'LOW' || energy === 'MEDIUM' || energy === 'HIGH' ? energy : null,
          location: location.trim() || null,
          project_id: projectId || null,
        });
      }
      if (block) {
        const startMin = labelToMinutes(start);
        const endMin = labelToMinutes(end);
        await updateLocalTimeBlock({
          id: block.id,
          userId,
          title: title.trim() || block.title,
          notes: notes.trim() ? notes : null,
          flexibility,
          locked,
          ...(startMin !== null ? { start_min: startMin } : {}),
          ...(endMin !== null ? { end_min: endMin } : {}),
        });
      }
      await onChange();
      dirty.current = false;
    } catch {
      setSaveError('Could not save all changes. Your draft is still here; please retry.');
    } finally {
      setSaving(false);
    }
  }

  const when = block
    ? `${minutesToLabel(block.start_min)}–${minutesToLabel(block.end_min)}`
    : task?.scheduled_for ?? 'unplaced';
  const source = task?.origin === 'user' ? 'you' : (task?.origin ?? block?.source_table ?? '—');
  const due = task?.due_at ? task.due_at.slice(0, 10) : 'none';

  return (
    <form className={styles.inspectCard} onChangeCapture={() => { dirty.current = true; }} onSubmit={(event) => void onSave(event)}>
      {saveError ? <p role="alert">{saveError}</p> : null}
      <div className={styles.inspectHead}>
        <p className={styles.inspectEyebrow}>Inspector</p>
        <p className={styles.inspectTitle}>{title || 'Untitled'}</p>
      </div>
      <div className={styles.inspectBody}>
        {blocked ? <p className={styles.note}>Blocked until a prerequisite is done.</p> : null}
        <div className={styles.inspectGrid}>
          <label className={styles.inspectField}>
            <span>When</span>
            {block ? (
              <span>
                <input value={start} onChange={(event) => setStart(event.target.value)} aria-label="Start" />
                –
                <input value={end} onChange={(event) => setEnd(event.target.value)} aria-label="End" />
              </span>
            ) : (
              <span>{when}</span>
            )}
          </label>
          <label className={styles.inspectField}>
            <span>Estimate</span>
            <input value={duration} onChange={(event) => setDuration(event.target.value)} inputMode="numeric" />
          </label>
          <label className={styles.inspectField}>
            <span>Energy</span>
            <select
              className={styles.select}
              value={energy}
              onChange={(event) => setEnergy(event.target.value)}
            >
              <option value="">Any</option>
              <option value="LOW">low</option>
              <option value="MEDIUM">steady</option>
              <option value="HIGH">high</option>
            </select>
          </label>
          <div className={styles.inspectField}>
            <span>Due</span>
            <span>{due}</span>
          </div>
          <div className={styles.inspectField}>
            <span>Source</span>
            <span>{source}</span>
          </div>
          <div className={styles.inspectField}>
            <span>Blocked by</span>
            <span>{blocked ? 'a prerequisite' : 'none'}</span>
          </div>
          <label className={styles.inspectField}>
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className={styles.inspectField}>
            <span>Flexibility</span>
            <select
              className={styles.select}
              value={flexibility}
              onChange={(event) => setFlexibility(event.target.value as ScheduleFlexibility)}
            >
              {FLEX.map((row) => (
                <option key={row} value={row}>
                  {row}
                </option>
              ))}
            </select>
          </label>
          {task ? (
            <label className={styles.inspectField}>
              <span>Repeats</span>
              <select
                className={styles.select}
                value={recurrence}
                onChange={(event) => setRecurrence(event.target.value as RecurrenceKind)}
              >
                {RECUR.map((row) => (
                  <option key={row} value={row}>
                    {row.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {task ? (
            <label className={styles.inspectField}>
              <span>Project</span>
              <select
                className={styles.select}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">None</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={styles.inspectField}>
            <span>Notes</span>
            <input value={notes ?? ''} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => setLocked(event.target.checked)}
          />
          Lock from Mus
        </label>
        <div className={styles.inspectActs}>
          <button type="submit" className={styles.plannerBtn} data-primary="true" disabled={saving}>
            Save
          </button>
          {task && onToggle ? (
            <button type="button" className={styles.liftAction} onClick={onToggle}>
              {task.completed_at ? 'Undo done' : 'Mark done'}
            </button>
          ) : null}
          {task && onPlace && !task.completed_at ? (
            <button type="button" className={styles.liftAction} onClick={onPlace}>
              Place on day
            </button>
          ) : null}
          {onMoveToday ? (
            <button type="button" className={styles.liftAction} onClick={onMoveToday}>
              Today
            </button>
          ) : null}
          {onMoveTomorrow ? (
            <button type="button" className={styles.liftAction} onClick={onMoveTomorrow}>
              Tomorrow
            </button>
          ) : null}
          {onMoveInbox ? (
            <button type="button" className={styles.liftAction} onClick={onMoveInbox}>
              Inbox
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" className={styles.liftAction} onClick={onDelete}>
              {task ? 'Delete task' : 'Remove block'}
            </button>
          ) : null}
        </div>
        <p className={styles.inspectNote}>
          Mus proposes placements. Confirm still writes. Locked blocks stay where you put them.
        </p>
      </div>
    </form>
  );
}
