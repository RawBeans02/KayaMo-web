'use client';

import {
  addLogicalCalendarDays,
  createLocalTask,
  createLocalTimeBlock,
  getLocalTaskMeta,
  listLocalFoodEntries,
  listLocalGoals,
  listLocalOpenTasks,
  listLocalOverdueTasks,
  listLocalProjects,
  listLocalTasksForDate,
  listLocalTimeBlocks,
  listLocalTimeBlocksRange,
  listLocalWorkoutHistory,
  recoverClosedOfflineDb,
  setLocalTaskCompleted,
  setLocalTaskScheduledFor,
  spawnRecurrenceIfNeeded,
  taskIsBlocked,
  tombstoneLocalTask,
  tombstoneLocalTimeBlock,
  undoLatestMusAction,
  updateLocalTimeBlock,
  type LocalGoal,
  type LocalPlanningProject,
  type LocalTask,
  type LocalTaskMeta,
  type LocalTimeBlock,
} from '@kayamo/offline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import { applyCaptureItems, applyDayPlan, applyWhatNowPick } from '../todo/apply-plan';
import {
  captureProposalSchema,
  dayPlanProposalSchema,
  whatNowSchema,
  type CaptureProposal,
  type DayPlanProposal,
  type WhatNow,
} from '../todo/planner-schema';
import {
  conflictIds,
  DESK_DAY_END_MIN,
  DESK_DAY_START_MIN,
  DESK_HOUR_PX,
  firstFit,
  labelToMinutes,
  minutesToLabel,
  openWindows,
  weekDates,
} from '../todo/timetable';
import styles from '../food/desk.module.css';
import { DeskMusPane } from './desk-mus';
import { TodosInspector } from './todos-inspector';
import { TodosTimeline } from './todos-timeline';
import { useDeskClock } from './use-desk-clock';

type Energy = 'LOW' | 'MEDIUM' | 'HIGH' | '';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function localMinutes(nowMs: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(nowMs));
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    const date = new Date(nowMs);
    return date.getHours() * 60 + date.getMinutes();
  }
}

function formatDeskStamp(nowMs: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(nowMs));
  } catch {
    return '';
  }
}

function hoursLabel(minutes: number): string {
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

function TaskBucket({
  label,
  tasks,
  overdue,
  selectedId,
  metaByTask,
  placedIds,
  today,
  onSelect,
  onToggle,
  onPlace,
}: {
  label: string;
  tasks: LocalTask[];
  overdue?: boolean;
  selectedId: string | null;
  metaByTask: Map<string, LocalTaskMeta>;
  placedIds: Set<string>;
  today: string;
  onSelect: (id: string) => void;
  onToggle: (task: LocalTask) => void;
  onPlace: (task: LocalTask) => void;
}) {
  return (
    <div className={styles.bucket} data-overdue={overdue ? 'true' : undefined}>
      <div className={styles.bucketHead} data-overdue={overdue ? 'true' : undefined}>
        <span className={styles.bucketLabel}>{label}</span>
        <span className={styles.bucketCount}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className={styles.bucketEmpty}>Nothing here.</p>
      ) : (
        tasks.map((task) => {
          const meta = metaByTask.get(task.id);
          const placed = placedIds.has(task.id);
          const due = Boolean(overdue || (task.due_at && task.due_at < new Date().toISOString() && !task.completed_at));
          const tag = due ? 'due' : task.origin !== 'user' ? 'Lis' : placed ? 'placed' : 'inbox';
          return (
            <div
              key={task.id}
              className={styles.taskRow}
              data-selected={selectedId === task.id ? 'true' : undefined}
            >
              <button
                type="button"
                className={styles.taskDot}
                data-done={task.completed_at ? 'true' : undefined}
                aria-label="Toggle done"
                onClick={() => onToggle(task)}
              >
                {task.completed_at ? '✓' : ''}
              </button>
              <button type="button" className={styles.taskSelect} onClick={() => onSelect(task.id)}>
                <span className={styles.taskTitle} data-done={task.completed_at ? 'true' : undefined}>
                  {task.title}
                </span>
                <span className={styles.taskSub}>
                  {meta?.estimated_duration_min ? `${meta.estimated_duration_min} min` : '30 min'}
                  {meta?.energy ? ` · ${meta.energy === 'MEDIUM' ? 'steady' : meta.energy.toLowerCase()}` : ''}
                  {task.scheduled_for && task.scheduled_for !== today ? ` · ${task.scheduled_for}` : ''}
                </span>
              </button>
              <span className={styles.taskTag} data-due={due ? 'true' : undefined}>
                {tag}
              </span>
              {!task.completed_at ? (
                <button type="button" className={styles.placeBtn} onClick={() => onPlace(task)}>
                  {placed ? 'Move' : 'Place'}
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export function TodosDesk({ userId }: { userId: string }) {
  const { clock, today, nowMs } = useDeskClock(userId);
  const tomorrow = useMemo(() => addLogicalCalendarDays(today, 1), [today]);
  const nowIso = new Date(nowMs).toISOString();
  const [view, setView] = useState<'day' | 'week' | 'agenda'>('day');
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const date = focusDate ?? today;
  const [todayTasks, setTodayTasks] = useState<LocalTask[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<LocalTask[]>([]);
  const [overdue, setOverdue] = useState<LocalTask[]>([]);
  const [later, setLater] = useState<LocalTask[]>([]);
  const [inbox, setInbox] = useState<LocalTask[]>([]);
  const [goals, setGoals] = useState<LocalGoal[]>([]);
  const [projects, setProjects] = useState<LocalPlanningProject[]>([]);
  const [blocks, setBlocks] = useState<LocalTimeBlock[]>([]);
  const [weekBlocks, setWeekBlocks] = useState<LocalTimeBlock[]>([]);
  const [metaByTask, setMetaByTask] = useState<Map<string, LocalTaskMeta>>(new Map());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [energy, setEnergy] = useState<Energy>('');
  const [plan, setPlan] = useState<DayPlanProposal | null>(null);
  const [whatNow, setWhatNow] = useState<WhatNow | null>(null);
  const [capture, setCapture] = useState<CaptureProposal | null>(null);

  const week = useMemo(() => weekDates(date), [date]);

  const load = useCallback(async () => {
    try {
      await recoverClosedOfflineDb(async () => {
        const [day, next, missed, open, allGoals, allProjects, dayBlocks, ranged] = await Promise.all([
          listLocalTasksForDate(userId, date),
          listLocalTasksForDate(userId, tomorrow),
          listLocalOverdueTasks(userId, today, nowIso),
          listLocalOpenTasks(userId),
          listLocalGoals(userId),
          listLocalProjects(userId),
          listLocalTimeBlocks(userId, date),
          listLocalTimeBlocksRange(userId, week[0] ?? date, week[6] ?? date),
        ]);
        const overdueIds = new Set(missed.map((row) => row.id));
        setTodayTasks(day);
        setTomorrowTasks(next);
        setOverdue(missed);
        setLater(
          open.filter(
            (row) => row.scheduled_for && row.scheduled_for > tomorrow && !overdueIds.has(row.id),
          ),
        );
        setInbox(open.filter((row) => !row.scheduled_for && !overdueIds.has(row.id)));
        setGoals(allGoals.filter((row) => row.status === 'active'));
        setProjects(allProjects);
        setBlocks(dayBlocks);
        setWeekBlocks(ranged);
        const metas = new Map<string, LocalTaskMeta>();
        const blocked = new Set<string>();
        const forMeta = new Map<string, LocalTask>();
        for (const task of [...open, ...day]) forMeta.set(task.id, task);
        await Promise.all(
          [...forMeta.values()].map(async (task) => {
            const meta = await getLocalTaskMeta(task.id);
            if (meta) metas.set(task.id, meta);
            if (await taskIsBlocked(userId, task.id)) blocked.add(task.id);
          }),
        );
        setMetaByTask(metas);
        setBlockedIds(blocked);
      });
    } catch {
      // IndexedDB can close during auth/scope switch; the next tick retries.
    }
  }, [date, nowIso, tomorrow, today, userId, week]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selectedTask =
    todayTasks.concat(tomorrowTasks, overdue, later, inbox).find((row) => row.id === selectedId) ??
    null;
  const selectedBlock = blocks.find((row) => row.id === selectedBlockId) ?? null;
  const selectedMeta = selectedTask ? (metaByTask.get(selectedTask.id) ?? null) : null;
  const conflicts = useMemo(() => conflictIds(blocks), [blocks]);
  const placedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of blocks) {
      if (block.source_table === 'tasks' && block.source_id) ids.add(block.source_id);
    }
    return ids;
  }, [blocks]);
  const doneIds = useMemo(
    () => new Set(todayTasks.filter((row) => row.completed_at).map((row) => row.id)),
    [todayTasks],
  );

  function matchesEnergy(task: LocalTask): boolean {
    if (!energy) return true;
    return metaByTask.get(task.id)?.energy === energy;
  }

  const placedToday = todayTasks.filter((task) => placedIds.has(task.id) && matchesEnergy(task));
  const unplaced = [...inbox, ...todayTasks.filter((task) => !placedIds.has(task.id))].filter(
    (task, index, list) => list.findIndex((row) => row.id === task.id) === index && matchesEnergy(task),
  );
  const laterTasks = [...tomorrowTasks, ...later].filter(matchesEnergy);
  const overdueShown = overdue.filter(matchesEnergy);

  const placedMin = blocks.reduce((sum, row) => sum + Math.max(0, row.end_min - row.start_min), 0);
  const freeMin = openWindows(blocks, DESK_DAY_START_MIN, DESK_DAY_END_MIN).reduce(
    (sum, window) => sum + (window.endMin - window.startMin),
    0,
  );
  const capacityWarn = placedMin > freeMin && blocks.length > 0;
  const nowMin = localMinutes(nowMs, clock.timeZone);

  const ghosts = (plan?.blocks ?? [])
    .map((block, index) => {
      const start = block.start ? labelToMinutes(block.start) : null;
      const end = block.end ? labelToMinutes(block.end) : null;
      if (start === null || end === null) return null;
      return { id: `ghost-${index}`, title: block.title, startMin: start, endMin: end };
    })
    .filter((row): row is { id: string; title: string; startMin: number; endMin: number } => row !== null);

  async function onAddTask(event: React.FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setError(null);
    try {
      await createLocalTask({
        userId,
        title,
        scheduledFor: date,
        origin: 'user',
      });
      setDraft('');
      await load();
    } catch {
      setError('Could not save that todo.');
    }
  }

  async function onParseDump() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setPlan(null);
    setWhatNow(null);
    try {
      const response = await apiFetch('/api/mus/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logicalDate: date, text }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Could not parse that dump.';
        setError(message);
        return;
      }
      const parsed = captureProposalSchema.safeParse(
        body && typeof body === 'object' && 'capture' in body
          ? (body as { capture: unknown }).capture
          : body,
      );
      if (!parsed.success) {
        setError('Lis returned a dump I could not use. Split it by hand.');
        return;
      }
      setCapture(parsed.data);
    } catch {
      setError('Could not parse that dump.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(task: LocalTask) {
    setError(null);
    if (!task.completed_at && blockedIds.has(task.id)) {
      setError('Something else has to finish first.');
      return;
    }
    const row = await setLocalTaskCompleted({
      id: task.id,
      userId,
      completed: !task.completed_at,
      timeZone: clock.timeZone,
      dayStartsAt: clock.dayStartsAt,
    });
    if (row && !task.completed_at) {
      await spawnRecurrenceIfNeeded({ userId, task: row, today });
    }
    await load();
  }

  async function onMove(task: LocalTask, scheduledFor: string | null) {
    setError(null);
    await setLocalTaskScheduledFor({ id: task.id, userId, scheduledFor });
    await load();
  }

  async function onDelete(task: LocalTask) {
    setError(null);
    await tombstoneLocalTask({ id: task.id, userId });
    if (selectedId === task.id) setSelectedId(null);
    await load();
  }

  async function onPlace(task: LocalTask) {
    const meta = metaByTask.get(task.id);
    if (meta?.flexibility === 'ANYTIME') {
      await setLocalTaskScheduledFor({ id: task.id, userId, scheduledFor: date });
      await load();
      return;
    }
    const duration = meta?.estimated_duration_min ?? 30;
    const slot = firstFit(openWindows(blocks, date === today ? Math.max(nowMin, DESK_DAY_START_MIN) : DESK_DAY_START_MIN, DESK_DAY_END_MIN), duration);
    if (!slot) {
      setError('No open window that long is left on this day.');
      return;
    }
    await setLocalTaskScheduledFor({ id: task.id, userId, scheduledFor: date });
    const existing = blocks.find((row) => row.source_id === task.id);
    if (existing) {
      await updateLocalTimeBlock({
        id: existing.id,
        userId,
        start_min: slot.startMin,
        end_min: slot.endMin,
      });
    } else {
      await createLocalTimeBlock({
        userId,
        logicalDate: date,
        title: task.title,
        startMin: slot.startMin,
        endMin: slot.endMin,
        sourceTable: 'tasks',
        sourceId: task.id,
      });
    }
    setSelectedBlockId(null);
    setSelectedId(task.id);
    await load();
  }

  async function onCommitBlock(id: string, startMin: number, endMin: number) {
    setError(null);
    try {
      const saved = await updateLocalTimeBlock({ id, userId, start_min: startMin, end_min: endMin });
      if (!saved) throw new Error('Unavailable');
      setBlocks(current => current.map(block => block.id === id ? saved : block));
    } catch {
      setError('Could not move this block. Your saved schedule is unchanged. Please retry.');
    }
  }

  async function onCreateAt(startMin: number) {
    setError(null);
    try {
      const row = await createLocalTimeBlock({
        userId, logicalDate: date, title: 'Block', startMin, endMin: startMin + 30,
      });
      setBlocks(current => [...current.filter(block => block.id !== row.id), row]);
      setSelectedBlockId(row.id);
      setSelectedId(null);
    } catch {
      setError('Could not create this block. Please retry.');
    }
  }

  async function collectPlanContext() {
    const open = await listLocalOpenTasks(userId);
    const history = await listLocalWorkoutHistory(userId);
    const last = history.find((row) => row.ended_at);
    const typical =
      last?.ended_at && last.started_at
        ? Math.max(15, Math.round((Date.parse(last.ended_at) - Date.parse(last.started_at)) / 60_000))
        : 75;
    const meals = await listLocalFoodEntries(userId, date);
    const active = history.find((row) => row.status === 'active' && row.logical_date === date);
    const done = history.some((row) => row.status === 'completed' && row.logical_date === date);
    return {
      tasks: await Promise.all(
        open.slice(0, 80).map(async (task) => {
          const meta = await getLocalTaskMeta(task.id);
          return {
            id: task.id,
            title: task.title,
            scheduledFor: task.scheduled_for,
            dueAt: task.due_at,
            durationMin: meta?.estimated_duration_min ?? 30,
            flexibility: meta?.flexibility ?? 'FLEXIBLE',
            locked: meta?.locked ?? false,
            blocked: await taskIsBlocked(userId, task.id),
            energy: meta?.energy ?? null,
            location: meta?.location ?? null,
          };
        }),
      ),
      blocks: blocks.map((row) => ({
        id: row.id,
        title: row.title,
        startMin: row.start_min,
        endMin: row.end_min,
        flexibility: row.flexibility,
        locked: row.locked,
        kind: row.kind,
      })),
      windows: openWindows(blocks, DESK_DAY_START_MIN, DESK_DAY_END_MIN).map((row) => ({
        startMin: row.startMin,
        endMin: row.endMin,
      })),
      gym: {
        status: active ? ('active' as const) : done ? ('completed' as const) : ('none' as const),
        typicalDurationMin: typical,
      },
      mealsLogged: meals.length,
    };
  }

  async function requestPlan(mode: DayPlanProposal['mode'], note: string | null) {
    setBusy(true);
    setError(null);
    setWhatNow(null);
    try {
      const context = await collectPlanContext();
      const response = await apiFetch('/api/mus/plan-day', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          logicalDate: date,
          mode,
          nowMin,
          energy: energy || null,
          location: null,
          weatherNote: null,
          note,
          ...context,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Could not plan the day.';
        setError(message);
        return;
      }
      const parsed = dayPlanProposalSchema.safeParse(
        body && typeof body === 'object' && 'plan' in body ? body.plan : body,
      );
      if (!parsed.success) {
        setError('Lis returned a plan we could not read.');
        return;
      }
      setPlan(parsed.data);
    } catch {
      setError('Could not plan the day.');
    } finally {
      setBusy(false);
    }
  }

  async function requestWhatNow() {
    setBusy(true);
    setError(null);
    setPlan(null);
    try {
      const open = await listLocalOpenTasks(userId);
      const windows = openWindows(blocks, Math.max(nowMin, DESK_DAY_START_MIN), DESK_DAY_END_MIN);
      const currentWindow = date === today ? windows.find((window) => window.startMin <= nowMin && window.endMin > nowMin) : null;
      const available = currentWindow ? currentWindow.endMin - nowMin : 0;
      if (available <= 0) { setError('There is no open window right now. Choose a later slot or adjust your timetable.'); return; }
      const response = await apiFetch('/api/mus/what-now', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          logicalDate: date,
          availableMinutes: Math.min(240, available),
          location: null,
          energy: energy || null,
          tasks: await Promise.all(
            open.slice(0, 40).map(async (task) => {
              const meta = await getLocalTaskMeta(task.id);
              return {
                id: task.id,
                title: task.title,
                durationMin: meta?.estimated_duration_min ?? 30,
                energy: meta?.energy ?? null,
                location: meta?.location ?? null,
                blocked: await taskIsBlocked(userId, task.id),
              };
            }),
          ),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError('Could not rank what to do now.');
        return;
      }
      const parsed = whatNowSchema.safeParse(
        body && typeof body === 'object' && 'whatNow' in body ? body.whatNow : body,
      );
      if (!parsed.success) {
        setError('Lis returned options we could not read.');
        return;
      }
      setWhatNow(parsed.data);
    } catch {
      setError('Could not rank what to do now.');
    } finally {
      setBusy(false);
    }
  }

  const stamp = formatDeskStamp(nowMs, clock.timeZone);

  return (
    <section className={styles.deskScreen} aria-labelledby="todos-title" data-todos="">
      <header className={styles.deskHead}>
        <div>
          <p className={styles.eyebrow}>Planning · {stamp}</p>
          <h1 id="todos-title" className={styles.title}>
            Todos
          </h1>
        </div>
        <div className={styles.segmented} role="tablist" aria-label="Schedule view">
          {(['day', 'week', 'agenda'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
            >
              {id === 'day' ? 'Day' : id === 'week' ? 'Week' : 'Agenda'}
            </button>
          ))}
        </div>
      </header>

      <section className={styles.plannerRow}>
        <button
          type="button"
          className={styles.plannerBtn}
          data-primary="true"
          disabled={busy}
          onClick={() => void requestPlan('standard', null)}
        >
          Plan my day
        </button>
        <button
          type="button"
          className={styles.plannerBtn}
          disabled={busy}
          onClick={() => void requestPlan('restructure', 'Replan remaining time from now.')}
        >
          Replan from now
        </button>
        <button type="button" className={styles.plannerBtn} disabled={busy} onClick={() => void requestWhatNow()}>
          What can I do now?
        </button>
        <button
          type="button"
          className={styles.plannerBtn}
          onClick={() => {
            void undoLatestMusAction(userId).then((summary) => {
              setError(summary ? `Undid: ${summary}` : 'Nothing to undo.');
              void load();
            });
          }}
        >
          Undo Lis
        </button>
        <span className={styles.energyGroup} role="group" aria-label="Energy">
          <span className={styles.busyLabel}>Energy</span>
          {(
            [
              ['LOW', 'low'],
              ['MEDIUM', 'steady'],
              ['HIGH', 'high'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={styles.energyChip}
              data-on={energy === id ? 'true' : undefined}
              onClick={() => setEnergy((current) => (current === id ? '' : id))}
            >
              {label}
            </button>
          ))}
        </span>
      </section>

      {capacityWarn ? (
        <p className={styles.capacityWarn}>
          {hoursLabel(placedMin)} placed against {hoursLabel(freeMin)} free. Confirm still writes.
          Lis will not shove the overflow into the evening.
        </p>
      ) : null}

      {capture ? (
        <div className={styles.consultCard}>
          <p className={styles.statLabel}>Dump proposal</p>
          <ul className={styles.plainList}>
            {capture.items.map((item) => (
              <li key={`${item.kind}-${item.title}`}>
                <strong>{item.title}</strong>
                <span className={styles.aliases}>
                  {' '}
                  · {item.kind.toLowerCase()}
                  {item.dueHint ? ` · ${item.dueHint}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {capture.questions.length > 0 ? (
            <p className={styles.statNote}>{capture.questions.join(' ')}</p>
          ) : null}
          <div className={styles.formRow}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => {
                void applyCaptureItems({ userId, today: date, capture }).then(async (result) => {
                  setError(result.message);
                  if (result.ok) {
                    setCapture(null);
                    setDraft('');
                  }
                  await load();
                });
              }}
            >
              Confirm dump
            </button>
            <button type="button" className={styles.ghost} onClick={() => setCapture(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {plan ? (
        <div className={styles.consultCard}>
          <p className={styles.statLabel}>
            {plan.overload ? 'Overloaded proposal' : 'Day proposal'} · {plan.mode}
          </p>
          <p className={styles.statNote}>{plan.summary}</p>
          <ul className={styles.plainList}>
            {plan.blocks.map((block) => (
              <li key={`${block.title}-${block.start ?? 'open'}`}>
                <strong>{block.title}</strong>
                <span className={styles.aliases}>
                  {block.start ? ` · ${block.start}–${block.end ?? ''}` : ' · anytime'} · {block.why}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.formRow}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => {
                void applyDayPlan({ userId, today: date, plan }).then(async (result) => {
                  setError(result.message);
                  setPlan(null);
                  await load();
                });
              }}
            >
              Confirm plan
            </button>
            <button type="button" className={styles.ghost} onClick={() => setPlan(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {whatNow ? (
        <div className={styles.consultCard}>
          <p className={styles.statLabel}>What now · {whatNow.availableMinutes} min</p>
          <ul className={styles.plainList}>
            {whatNow.options.map((option) => (
              <li key={option.title}>
                <button
                  type="button"
                  className={styles.textAction}
                  onClick={() => {
                    void applyWhatNowPick({
                      userId,
                      today: date,
                      option,
                      blocks,
                      nowMin,
                    }).then(async (result) => {
                      setError(result.message);
                      if (result.ok) setWhatNow(null);
                      await load();
                    });
                  }}
                >
                  {option.title}
                </button>
                <span className={styles.aliases}>
                  {' '}
                  · {option.durationMin} min · {option.why}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.ghost} onClick={() => setWhatNow(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <p className={styles.note} role="alert">
          {error}
        </p>
      ) : null}

      {view === 'day' ? (
        <section className={styles.todoDay}>
          <div className={styles.ttCard}>
            <div className={styles.ttHead}>
              <span>Timetable</span>
              <span>{hoursLabel(freeMin)} free</span>
            </div>
            <div className={styles.ttScroll}>
              <TodosTimeline
                blocks={blocks}
                ghosts={ghosts}
                conflicts={conflicts}
                selectedId={selectedBlockId}
                doneIds={doneIds}
                nowMin={date === today ? nowMin : null}
                dayStart={DESK_DAY_START_MIN}
                dayEnd={DESK_DAY_END_MIN}
                hourPx={DESK_HOUR_PX}
                onSelect={(id) => {
                  setSelectedBlockId(id);
                  const source = blocks.find((row) => row.id === id)?.source_id;
                  if (source) setSelectedId(source);
                }}
                onCommit={onCommitBlock}
                onCreateAt={(startMin) => void onCreateAt(startMin)}
                onGhostCommit={(id, startMin, endMin) => {
                  const index = Number(id.slice('ghost:'.length));
                  if (!Number.isInteger(index)) return;
                  setPlan(current => current ? {
                    ...current,
                    blocks: current.blocks.map((block, i) => i === index ? {
                      ...block, start: minutesToLabel(startMin), end: minutesToLabel(endMin),
                    } : block),
                  } : current);
                }}
                onDelete={(id) => {
                  if (id.startsWith('ghost:')) return;
                  void tombstoneLocalTimeBlock({ id, userId }).then(() => {
                    setBlocks(current => current.filter(block => block.id !== id));
                    setSelectedBlockId(null);
                  }).catch(() => setError('Could not remove this block. Please retry.'));
                }}
              />
            </div>
            <div className={styles.ttLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} data-kind="fixed" />
                fixed
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} data-kind="done" />
                done
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} data-kind="planned" />
                planned
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} data-kind="proposed" />
                from Lis
              </span>
            </div>
          </div>

          <div className={styles.todoWork}>
            <form className={styles.captureRow} onSubmit={(event) => void onAddTask(event)}>
              <input
                className={styles.captureInput}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="One honest next action…"
                aria-label="Capture a task"
                autoComplete="off"
              />
              <button type="submit" className={styles.captureAdd} disabled={!draft.trim()}>
                Add
              </button>
              <button
                type="button"
                className={styles.captureGhost}
                disabled={!draft.trim() || busy}
                onClick={() => void onParseDump()}
              >
                Brain dump
              </button>
            </form>

            {overdueShown.length > 0 ? (
              <TaskBucket
                label="Overdue"
                overdue
                tasks={overdueShown}
                selectedId={selectedId}
                metaByTask={metaByTask}
                placedIds={placedIds}
                today={today}
                onSelect={(id) => {
                  setSelectedId(id);
                  setSelectedBlockId(null);
                }}
                onToggle={onToggle}
                onPlace={onPlace}
              />
            ) : null}
            <TaskBucket
              label="Placed today"
              tasks={placedToday}
              selectedId={selectedId}
              metaByTask={metaByTask}
              placedIds={placedIds}
              today={today}
              onSelect={(id) => {
                setSelectedId(id);
                setSelectedBlockId(null);
              }}
              onToggle={onToggle}
              onPlace={onPlace}
            />
            <TaskBucket
              label="Unplaced"
              tasks={unplaced}
              selectedId={selectedId}
              metaByTask={metaByTask}
              placedIds={placedIds}
              today={today}
              onSelect={(id) => {
                setSelectedId(id);
                setSelectedBlockId(null);
              }}
              onToggle={onToggle}
              onPlace={onPlace}
            />
            <TaskBucket
              label="Later this week"
              tasks={laterTasks}
              selectedId={selectedId}
              metaByTask={metaByTask}
              placedIds={placedIds}
              today={today}
              onSelect={(id) => {
                setSelectedId(id);
                setSelectedBlockId(null);
              }}
              onToggle={onToggle}
              onPlace={onPlace}
            />

            <TodosInspector
              userId={userId}
              task={selectedTask}
              block={selectedBlock}
              meta={selectedMeta}
              projects={projects}
              blocked={selectedTask ? blockedIds.has(selectedTask.id) : false}
              onChange={load}
              onToggle={selectedTask ? () => void onToggle(selectedTask) : undefined}
              onPlace={selectedTask ? () => void onPlace(selectedTask) : undefined}
              onMoveToday={selectedTask ? () => void onMove(selectedTask, today) : undefined}
              onMoveTomorrow={selectedTask ? () => void onMove(selectedTask, tomorrow) : undefined}
              onMoveInbox={selectedTask ? () => void onMove(selectedTask, null) : undefined}
              onDelete={
                selectedTask
                  ? () => void onDelete(selectedTask)
                  : selectedBlock
                    ? () =>
                        void tombstoneLocalTimeBlock({ id: selectedBlock.id, userId }).then(() => {
                          setSelectedBlockId(null);
                          void load();
                        })
                    : undefined
              }
            />
          </div>
        </section>
      ) : null}

      {view === 'week' ? (
        <section className={styles.weekBoard}>
          <div className={styles.weekBoardInner}>
            {week.map((day, index) => {
              const chips = weekBlocks.filter((row) => row.logical_date === day);
              return (
                <button
                  key={day}
                  type="button"
                  className={styles.weekCol}
                  data-today={day === today ? 'true' : undefined}
                  onClick={() => {
                    setFocusDate(day);
                    setView('day');
                  }}
                >
                  <div className={styles.weekDayHead}>
                    <p className={styles.weekDayName}>{WEEKDAYS[index]}</p>
                    <p className={styles.weekDayNum}>{Number(day.slice(8))}</p>
                  </div>
                  <div className={styles.weekChips}>
                    {chips.length === 0 ? (
                      <span className={styles.weekQuiet}>quiet</span>
                    ) : (
                      chips.map((row) => (
                        <span key={row.id} className={styles.weekChipCard}>
                          <span className={styles.weekChipTime}>{minutesToLabel(row.start_min)}</span>
                          <span className={styles.weekChipTitle}>{row.title}</span>
                        </span>
                      ))
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === 'agenda' ? (
        <section className={styles.agendaWrap}>
          {[
            { label: 'Overdue', tasks: overdueShown, overdue: true },
            { label: 'Today', tasks: todayTasks.filter(matchesEnergy), overdue: false },
            { label: 'Later', tasks: laterTasks, overdue: false },
          ].map((group) => (
            <div key={group.label} className={styles.bucket} data-overdue={group.overdue ? 'true' : undefined}>
              <div className={styles.bucketHead} data-overdue={group.overdue ? 'true' : undefined}>
                <span className={styles.bucketLabel}>{group.label}</span>
                <span className={styles.bucketCount}>{group.tasks.length}</span>
              </div>
              {group.tasks.length === 0 ? (
                <p className={styles.bucketEmpty}>Nothing here.</p>
              ) : (
                group.tasks.map((task) => {
                  const meta = metaByTask.get(task.id);
                  const due = group.overdue;
                  return (
                    <div
                      key={task.id}
                      className={styles.agendaRow}
                      data-selected={selectedId === task.id ? 'true' : undefined}
                    >
                      <button
                        type="button"
                        className={styles.taskDot}
                        data-done={task.completed_at ? 'true' : undefined}
                        aria-label="Toggle done"
                        onClick={() => void onToggle(task)}
                      >
                        {task.completed_at ? '✓' : ''}
                      </button>
                      <span
                        className={styles.taskTitle}
                        data-done={task.completed_at ? 'true' : undefined}
                      >
                        {task.title}
                      </span>
                      <span className={styles.taskSub}>
                        {meta?.estimated_duration_min ? `${meta.estimated_duration_min} min` : '30 min'}
                      </span>
                      <span className={styles.taskSub}>{task.scheduled_for ?? 'inbox'}</span>
                      <span className={styles.taskTag} data-due={due ? 'true' : undefined}>
                        {due ? 'due' : task.origin !== 'user' ? 'Lis' : 'open'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </section>
      ) : null}

      {goals.length > 0 && view === 'agenda' ? (
        <ul className={styles.plainList}>
          {goals.map((goal) => (
            <li key={goal.id}>
              <strong>{goal.title}</strong>
              {goal.target_date ? <span className={styles.aliases}> · {goal.target_date}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <DeskMusPane
        userId={userId}
        logicalDate={today}
        module="todos"
        view={view}
        selectedIds={selectedId ? [selectedId] : []}
        selectionLabel={selectedTask?.title}
      />
    </section>
  );
}
