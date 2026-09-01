'use client';

import {
  addLogicalCalendarDays,
  createLocalGoal,
  createLocalProject,
  createLocalTask,
  createLocalTimeBlock,
  getLocalTaskMeta,
  listLocalGoals,
  listLocalOpenTasks,
  listLocalOverdueTasks,
  listLocalProjects,
  listLocalTasksForDate,
  listLocalTimeBlocks,
  listLocalTimeBlocksRange,
  listLocalWorkoutHistory,
  listLocalFoodEntries,
  setLocalTaskCompleted,
  setLocalTaskScheduledFor,
  spawnRecurrenceIfNeeded,
  taskIsBlocked,
  tombstoneLocalTask,
  undoLatestMusAction,
  updateLocalTask,
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
import { conflictIds, firstFit, minutesToLabel, openWindows, weekDates } from '../todo/timetable';
import styles from '../food/desk.module.css';
import { DeskMusPane } from './desk-mus';
import { TodosInspector } from './todos-inspector';
import { TodosTimeline } from './todos-timeline';
import { useDeskClock } from './use-desk-clock';

function TaskRows({
  tasks,
  today,
  tomorrow,
  selectedId,
  editingId,
  draft,
  onSelect,
  onToggle,
  onStartEdit,
  onDraft,
  onSaveEdit,
  onMove,
  onDelete,
  onPlace,
}: {
  tasks: LocalTask[];
  today: string;
  tomorrow: string;
  selectedId: string | null;
  editingId: string | null;
  draft: string;
  onSelect: (id: string) => void;
  onToggle: (task: LocalTask) => void;
  onStartEdit: (task: LocalTask) => void;
  onDraft: (value: string) => void;
  onSaveEdit: (task: LocalTask) => void;
  onMove: (task: LocalTask, scheduledFor: string | null) => void;
  onDelete: (task: LocalTask) => void;
  onPlace?: (task: LocalTask) => void;
}) {
  if (tasks.length === 0) return <p className={styles.empty}>Nothing here.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Task</th>
            <th scope="col">When</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const when = task.completed_at
              ? 'done'
              : task.scheduled_for === today
                ? 'today'
                : task.scheduled_for === tomorrow
                  ? 'tomorrow'
                  : task.scheduled_for ?? 'inbox';
            return (
              <tr
                key={task.id}
                data-selected={selectedId === task.id ? 'true' : undefined}
              >
                <th scope="row">
                  {editingId === task.id ? (
                    <input
                      className={styles.inlineInput}
                      value={draft}
                      onChange={(event) => onDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          onSaveEdit(task);
                        }
                      }}
                      aria-label="Edit title"
                    />
                  ) : (
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={() => onSelect(task.id)}
                      aria-pressed={selectedId === task.id}
                    >
                      {task.title}
                    </button>
                  )}
                </th>
                <td>{when}</td>
                <td>
                  <div className={styles.taskActions}>
                    <button type="button" className={styles.ghost} onClick={() => onToggle(task)}>
                      {task.completed_at ? 'Undo done' : 'Done'}
                    </button>
                    {editingId === task.id ? (
                      <button type="button" className={styles.ghost} onClick={() => onSaveEdit(task)}>
                        Save
                      </button>
                    ) : (
                      <button type="button" className={styles.ghost} onClick={() => onStartEdit(task)}>
                        Edit
                      </button>
                    )}
                    {onPlace && !task.completed_at ? (
                      <button type="button" className={styles.ghost} onClick={() => onPlace(task)}>
                        Place
                      </button>
                    ) : null}
                    {task.scheduled_for !== today ? (
                      <button type="button" className={styles.ghost} onClick={() => onMove(task, today)}>
                        Today
                      </button>
                    ) : null}
                    {task.scheduled_for !== tomorrow ? (
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onMove(task, tomorrow)}
                      >
                        Tomorrow
                      </button>
                    ) : null}
                    {task.scheduled_for !== null ? (
                      <button type="button" className={styles.ghost} onClick={() => onMove(task, null)}>
                        Inbox
                      </button>
                    ) : null}
                    <button type="button" className={styles.ghost} onClick={() => onDelete(task)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function localMinutes(nowMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
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
  const [pin, setPin] = useState<'today' | 'inbox'>('today');
  const [goalDraft, setGoalDraft] = useState('');
  const [projectDraft, setProjectDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [energy, setEnergy] = useState<'LOW' | 'MEDIUM' | 'HIGH' | ''>('');
  const [location, setLocation] = useState('');
  const [weather, setWeather] = useState('');
  const [plan, setPlan] = useState<DayPlanProposal | null>(null);
  const [whatNow, setWhatNow] = useState<WhatNow | null>(null);
  const [capture, setCapture] = useState<CaptureProposal | null>(null);

  const week = useMemo(() => weekDates(date), [date]);

  const load = useCallback(async () => {
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
    await Promise.all(
      open.map(async (task) => {
        const meta = await getLocalTaskMeta(task.id);
        if (meta) metas.set(task.id, meta);
        if (await taskIsBlocked(userId, task.id)) blocked.add(task.id);
      }),
    );
    setMetaByTask(metas);
    setBlockedIds(blocked);
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

  async function onAddTask(event: React.FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setError(null);
    try {
      await createLocalTask({
        userId,
        title,
        scheduledFor: pin === 'today' ? date : null,
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
        setError('Mus returned a dump I could not use. Split it by hand.');
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
    if (editingId === task.id) setEditingId(null);
    await load();
  }

  async function onSaveEdit(task: LocalTask) {
    setError(null);
    const title = editDraft.trim();
    if (!title) return;
    await updateLocalTask({ id: task.id, userId, title });
    setEditingId(null);
    await load();
  }

  async function onAddGoal(event: React.FormEvent) {
    event.preventDefault();
    const title = goalDraft.trim();
    if (!title) return;
    setError(null);
    try {
      await createLocalGoal({ userId, title, origin: 'user' });
      setGoalDraft('');
      await load();
    } catch {
      setError('Could not save that goal.');
    }
  }

  async function onAddProject(event: React.FormEvent) {
    event.preventDefault();
    const title = projectDraft.trim();
    if (!title) return;
    await createLocalProject({ userId, title });
    setProjectDraft('');
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
    const slot = firstFit(openWindows(blocks), duration);
    if (!slot) {
      setError('No open window that long is left on this day.');
      return;
    }
    await setLocalTaskScheduledFor({ id: task.id, userId, scheduledFor: date });
    await createLocalTimeBlock({
      userId,
      logicalDate: date,
      title: task.title,
      startMin: slot.startMin,
      endMin: slot.endMin,
      sourceTable: 'tasks',
      sourceId: task.id,
    });
    setSelectedBlockId(null);
    setSelectedId(task.id);
    await load();
  }

  async function onCommitBlock(id: string, startMin: number, endMin: number) {
    await updateLocalTimeBlock({ id, userId, start_min: startMin, end_min: endMin });
    await load();
  }

  async function onCreateAt(startMin: number) {
    const row = await createLocalTimeBlock({
      userId,
      logicalDate: date,
      title: 'Block',
      startMin,
      endMin: startMin + 30,
    });
    setSelectedBlockId(row.id);
    setSelectedId(null);
    await load();
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
      windows: openWindows(blocks).map((row) => ({ startMin: row.startMin, endMin: row.endMin })),
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
          nowMin: localMinutes(nowMs, clock.timeZone),
          energy: energy || null,
          location: location.trim() || null,
          weatherNote: weather.trim() || null,
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
        setError('Mus returned a plan we could not read.');
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
      const windows = openWindows(blocks);
      const available = windows[0] ? windows[0].endMin - windows[0].startMin : 30;
      const response = await apiFetch('/api/mus/what-now', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          logicalDate: date,
          availableMinutes: Math.max(15, Math.min(240, available)),
          location: location.trim() || 'home',
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
        setError('Mus returned options we could not read.');
        return;
      }
      setWhatNow(parsed.data);
    } catch {
      setError('Could not rank what to do now.');
    } finally {
      setBusy(false);
    }
  }

  const rowProps = {
    today,
    tomorrow,
    selectedId,
    editingId,
    draft: editDraft,
    onSelect: (id: string) => {
      setSelectedId(id);
      setSelectedBlockId(null);
    },
    onToggle,
    onStartEdit: (task: LocalTask) => {
      setSelectedId(task.id);
      setEditingId(task.id);
      setEditDraft(task.title);
    },
    onDraft: setEditDraft,
    onSaveEdit,
    onMove,
    onDelete,
    onPlace,
  };

  return (
    <section className={styles.panel} aria-labelledby="todos-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Planning</p>
          <h1 id="todos-title" className={styles.title}>
            Todos
          </h1>
          <p className={styles.lede}>
            Day, week, and agenda. Drag the timetable; confirm still writes. Mus on the right is
            the same assistant as the Mus tab.
          </p>
        </div>
      </header>

      <div className={styles.dashSplit}>
        <div className={styles.dashMain}>
          <form className={styles.formRow} onSubmit={(event) => void onAddTask(event)}>
            <label className={styles.grow}>
              Capture
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="One honest next action…"
                autoComplete="off"
              />
            </label>
            <label>
              Pin
              <select
                className={styles.select}
                value={pin}
                onChange={(event) => setPin(event.target.value === 'inbox' ? 'inbox' : 'today')}
              >
                <option value="today">Today</option>
                <option value="inbox">Inbox</option>
              </select>
            </label>
            <button type="submit" className={styles.primary} disabled={!draft.trim()}>
              Add
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={!draft.trim() || busy}
              onClick={() => void onParseDump()}
            >
              Parse dump
            </button>
          </form>

          <div className={styles.formRow}>
            <div className={styles.dayViews} role="tablist" aria-label="Schedule view">
              {(['day', 'week', 'agenda'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  className={styles.ghost}
                  onClick={() => setView(id)}
                >
                  {id}
                </button>
              ))}
            </div>
            <button type="button" className={styles.ghost} onClick={() => setFocusDate(today)}>
              {date}
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={busy}
              onClick={() => void requestPlan('standard', null)}
            >
              Plan my day
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={busy}
              onClick={() => void requestPlan('restructure', 'Replan remaining time from now.')}
            >
              Replan
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={busy}
              onClick={() =>
                void requestPlan(
                  'standard',
                  'Fill remaining open windows with unscheduled work. Do not move FIXED or locked blocks.',
                )
              }
            >
              Fill
            </button>
            <button type="button" className={styles.ghost} disabled={busy} onClick={() => void requestWhatNow()}>
              What now
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                void undoLatestMusAction(userId).then((summary) => {
                  setError(summary ? `Undid: ${summary}` : 'Nothing to undo.');
                  void load();
                });
              }}
            >
              Undo Mus
            </button>
          </div>

          <div className={styles.formRow}>
            <label>
              Energy
              <select
                className={styles.select}
                value={energy}
                onChange={(event) =>
                  setEnergy(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | '')
                }
              >
                <option value="">Any</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            <label>
              Location
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="home, campus…"
              />
            </label>
            <label>
              Weather
              <input
                value={weather}
                onChange={(event) => setWeather(event.target.value)}
                placeholder="rain, heat… (you type it)"
              />
            </label>
          </div>

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
                      {block.start ? ` · ${block.start}–${block.end ?? ''}` : ' · anytime'} ·{' '}
                      {block.why}
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

          {view === 'day' ? (
            <div className={styles.daySplit}>
              <TodosTimeline
                blocks={blocks}
                conflicts={conflicts}
                selectedId={selectedBlockId}
                onSelect={(id) => {
                  setSelectedBlockId(id);
                  const source = blocks.find((row) => row.id === id)?.source_id;
                  if (source) setSelectedId(source);
                }}
                onCommit={(id, startMin, endMin) => void onCommitBlock(id, startMin, endMin)}
                onCreateAt={(startMin) => void onCreateAt(startMin)}
              />
              <TodosInspector
                userId={userId}
                task={selectedTask}
                block={selectedBlock}
                meta={selectedMeta}
                projects={projects}
                blocked={selectedTask ? blockedIds.has(selectedTask.id) : false}
                onChange={load}
              />
            </div>
          ) : null}

          {view === 'week' ? (
            <div className={styles.weekGrid}>
              {week.map((day) => (
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
                  <p className={styles.statLabel}>{day.slice(5)}</p>
                  {weekBlocks
                    .filter((row) => row.logical_date === day)
                    .map((row) => (
                      <p key={row.id} className={styles.weekChip}>
                        {minutesToLabel(row.start_min)} {row.title}
                      </p>
                    ))}
                </button>
              ))}
            </div>
          ) : null}

          {view === 'agenda' ? (
            <>
              {overdue.length > 0 ? (
                <>
                  <p className={styles.statLabel}>Overdue</p>
                  <TaskRows tasks={overdue} {...rowProps} />
                </>
              ) : null}
              <p className={styles.statLabel}>Today · {today}</p>
              <TaskRows tasks={todayTasks} {...rowProps} />
              <p className={styles.statLabel}>Tomorrow · {tomorrow}</p>
              <TaskRows tasks={tomorrowTasks} {...rowProps} />
              {later.length > 0 ? (
                <>
                  <p className={styles.statLabel}>Later</p>
                  <TaskRows tasks={later} {...rowProps} />
                </>
              ) : null}
            </>
          ) : (
            <>
              {overdue.length > 0 ? (
                <>
                  <p className={styles.statLabel}>Overdue</p>
                  <TaskRows tasks={overdue} {...rowProps} />
                </>
              ) : null}
              <p className={styles.statLabel}>Inbox</p>
              <TaskRows tasks={inbox} {...rowProps} />
            </>
          )}

          <form className={styles.formRow} onSubmit={(event) => void onAddProject(event)}>
            <label className={styles.grow}>
              Project
              <input
                value={projectDraft}
                onChange={(event) => setProjectDraft(event.target.value)}
                placeholder="Teacher training…"
                autoComplete="off"
              />
            </label>
            <button type="submit" className={styles.primary} disabled={!projectDraft.trim()}>
              Save project
            </button>
          </form>

          <form className={styles.formRow} onSubmit={(event) => void onAddGoal(event)}>
            <label className={styles.grow}>
              Goal
              <input
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
                placeholder="What are you working toward?"
                autoComplete="off"
              />
            </label>
            <button type="submit" className={styles.primary} disabled={!goalDraft.trim()}>
              Save goal
            </button>
          </form>

          {goals.length === 0 ? (
            <p className={styles.empty}>No active goals yet.</p>
          ) : (
            <ul className={styles.plainList}>
              {goals.map((goal) => (
                <li key={goal.id}>
                  <strong>{goal.title}</strong>
                  {goal.target_date ? (
                    <span className={styles.aliases}> · {goal.target_date}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {error ? (
            <p className={styles.note} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DeskMusPane
          userId={userId}
          logicalDate={today}
          module="todos"
          view={view}
          selectedIds={selectedId ? [selectedId] : []}
          selectionLabel={selectedTask?.title}
        />
      </div>
    </section>
  );
}
