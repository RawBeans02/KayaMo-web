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
import { useEffect, useState } from 'react';
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
}: {
  userId: string;
  task: LocalTask | null;
  block: LocalTimeBlock | null;
  meta: LocalTaskMeta | null;
  projects: LocalPlanningProject[];
  blocked: boolean;
  onChange: () => Promise<void>;
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

  useEffect(() => {
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
    return <p className={styles.empty}>Select a task or a block to inspect it.</p>;
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.inspector} onSubmit={(event) => void onSave(event)}>
      <p className={styles.statLabel}>Inspector</p>
      {blocked ? <p className={styles.note}>Blocked until a prerequisite is done.</p> : null}
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Notes
        <input value={notes ?? ''} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {block ? (
        <div className={styles.formRow}>
          <label>
            Start
            <input value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            End
            <input value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>
      ) : null}
      <label>
        Flexibility
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
      <label className={styles.checkLabel}>
        <input
          type="checkbox"
          checked={locked}
          onChange={(event) => setLocked(event.target.checked)}
        />
        Lock from Mus
      </label>
      {task ? (
        <>
          <label>
            Duration (min)
            <input value={duration} onChange={(event) => setDuration(event.target.value)} inputMode="numeric" />
          </label>
          <label>
            Repeats
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
          <label>
            Energy
            <select
              className={styles.select}
              value={energy}
              onChange={(event) => setEnergy(event.target.value)}
            >
              <option value="">Any</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
          <label>
            Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} />
          </label>
          <label>
            Project
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
        </>
      ) : null}
      <button type="submit" className={styles.primary} disabled={saving}>
        Save
      </button>
    </form>
  );
}
