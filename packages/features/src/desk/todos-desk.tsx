'use client';

import {
  addLogicalCalendarDays,
  createLocalGoal,
  createLocalProject,
  createLocalTask,
  getLocalTaskMeta,
  listLocalGoals,
  listLocalOpenTasks,
  listLocalOverdueTasks,
  listLocalProjects,
  listLocalTasksForDate,
  listLocalTimeBlocks,
  listLocalTimeBlocksRange,
  setLocalTaskCompleted,
  setLocalTaskScheduledFor,
  spawnRecurrenceIfNeeded,
  taskIsBlocked,
  tombstoneLocalTask,
  undoLatestMusAction,
  updateLocalTask,
  type LocalGoal,
  type LocalPlanningProject,
  type LocalTask,
  type LocalTaskMeta,
  type LocalTimeBlock,
} from '@kayamo/offline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { conflictIds, minutesToLabel, weekDates } from '../todo/timetable';
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
  };

  return (
    <section className={styles.panel} aria-labelledby="todos-title" data-todos="">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Planning</p>
          <h1 id="todos-title" className={styles.title}>
            Todos
          </h1>
          <p className={styles.lede}>
            Read the list and check things off. Drag placement, capacity math, and energy
            filters wait until food logging has a month of real use.
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

          {view === 'day' ? (
            <div className={styles.daySplit}>
              <TodosTimeline
                blocks={blocks}
                conflicts={conflicts}
                selectedId={selectedBlockId}
                readOnly
                onSelect={(id) => {
                  setSelectedBlockId(id);
                  const source = blocks.find((row) => row.id === id)?.source_id;
                  if (source) setSelectedId(source);
                }}
                onCommit={() => undefined}
                onCreateAt={() => undefined}
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
          ) : view === 'day' ? (
            <>
              {overdue.length > 0 ? (
                <>
                  <p className={styles.statLabel}>Overdue</p>
                  <TaskRows tasks={overdue} {...rowProps} />
                </>
              ) : null}
              <p className={styles.statLabel}>Today · {today}</p>
              <TaskRows tasks={todayTasks} {...rowProps} />
              <p className={styles.statLabel}>Inbox</p>
              <TaskRows tasks={inbox} {...rowProps} />
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
