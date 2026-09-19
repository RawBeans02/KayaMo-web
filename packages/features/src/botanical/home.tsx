'use client';

import {
  createLocalTask,
  listLocalTasksForDate,
  listLocalTimeBlocks,
  listLocalWorkoutHistory,
  setLocalTaskCompleted,
  useLiveFoodEntries,
  type LocalTask,
} from '@kayamo/offline';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useDeskClock } from '../desk/use-desk-clock';
import { minutesToLabel, weekDates } from '../todo/timetable';
import { BotanicalIcon } from './icons';
import { useRecords } from './use-records';
import { TaskEditor } from './task-editor';
import styles from './botanical.module.css';

/** The last seven logical days ending on `date`, inclusive. */
function windowStart(date: string) {
  const start = new Date(date + 'T12:00:00Z');
  start.setUTCDate(start.getUTCDate() - 6);
  return start.toISOString().slice(0, 10);
}

export function BotanicalHome({ userId }: { userId: string }) {
  const { clock, today } = useDeskClock(userId);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<LocalTask | null>(null);
  const date = selected ?? today;
  const load = useCallback(async () => {
    const [tasks, blocks, workouts] = await Promise.all([
      listLocalTasksForDate(userId, date),
      listLocalTimeBlocks(userId, date),
      listLocalWorkoutHistory(userId),
    ]);
    return { tasks, blocks, workouts };
  }, [userId, date]);
  const { data, error, refresh } = useRecords(load);
  const entries = useLiveFoodEntries(userId, date);
  const [draft, setDraft] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState<{
    id: string;
    completed: boolean;
  } | null>(null);
  const mutation = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const draftKey = 'kayamo:home-capture:' + userId;
  useEffect(() => {
    try {
      setDraft(sessionStorage.getItem(draftKey) ?? '');
    } catch {
      /* Input remains usable without browser storage. */
    }
    setDraftReady(true);
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady) return;
    try {
      if (draft) sessionStorage.setItem(draftKey, draft);
      else sessionStorage.removeItem(draftKey);
    } catch {
      /* Offline DB writes still report their own errors. */
    }
  }, [draft, draftKey, draftReady]);
  const tasks = data?.tasks ?? [];
  const blocks = data?.blocks ?? [];
  const unfinished = tasks.filter((task) => !task.completed_at);
  const unscheduled = unfinished.filter(
    (task) =>
      !blocks.some(
        (block) => block.source_table === 'tasks' && block.source_id === task.id,
      ),
  );
  const activeWorkout = data?.workouts.find((workout) => workout.status === 'active');
  const completedWorkouts =
    data?.workouts.filter(
      (workout) => workout.logical_date === date && workout.status === 'completed',
    ).length ?? 0;

  /* ── Next up: the one step the day is asking for right now ───────── */
  const leadBlock = blocks[0] ?? null;
  const leadTask = leadBlock
    ? leadBlock.source_table === 'tasks'
      ? (tasks.find((task) => task.id === leadBlock.source_id) ?? null)
      : null
    : (unscheduled[0] ?? null);
  const nextTitle = leadBlock ? leadBlock.title : (unscheduled[0]?.title ?? null);
  const nextTime = leadBlock ? minutesToLabel(leadBlock.start_min) : null;
  const nextMeta = leadBlock
    ? leadBlock.end_min - leadBlock.start_min + ' min · Scheduled'
    : 'No time set · Your daily plan';
  const doneCount = tasks.filter((task) => task.completed_at).length;

  /* ── Glance figures, read straight from confirmed records ────────── */
  const kcal = Math.round(entries.reduce((sum, row) => sum + (Number(row.kcal) || 0), 0));
  const mealsLogged = new Set(entries.map((row) => row.meal_slot)).size;
  const from = windowStart(date);
  const activeDays = new Set(
    (data?.workouts ?? [])
      .filter(
        (workout) =>
          workout.status === 'completed' &&
          workout.logical_date >= from &&
          workout.logical_date <= date,
      )
      .map((workout) => workout.logical_date),
  ).size;

  async function capture(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || mutation.current) return;
    mutation.current = true;
    setBusy(true);
    try {
      await createLocalTask({
        userId,
        title: draft.trim(),
        scheduledFor: date,
        sortOrder: tasks.length,
      });
      setDraft('');
      setNotice('Added to your plan.');
      await refresh();
      input.current?.focus();
    } catch {
      setNotice('Could not save this task. Your draft is still here, please retry.');
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function complete(task: LocalTask) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setPendingCompletion({ id: task.id, completed: !task.completed_at });
    try {
      const saved = await setLocalTaskCompleted({
        id: task.id,
        userId,
        completed: !task.completed_at,
        ...clock,
      });
      if (!saved) throw new Error('Unavailable');
      setNotice(
        task.completed_at ? 'Task reopened.' : 'Task completed. Uncheck it to reopen.',
      );
      await refresh();
    } catch {
      setNotice('Could not update this task. Please retry.');
    } finally {
      mutation.current = false;
      setBusy(false);
      setPendingCompletion(null);
    }
  }
  return (
    <section className={styles.page} aria-labelledby="home-title">
      <header className={styles.header}>
        <div>
          <p className={styles.homeDate}>
            {new Date(date + 'T12:00:00Z').toLocaleDateString('en-PH', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
          <h1 id="home-title" className="kgTitle">
            Home
          </h1>
        </div>
        <a className={`${styles.ask} kgGhost`} href="/mus">
          <span className={styles.askMark} aria-hidden="true">
            <BotanicalIcon name="lis" size={18} weight="fill" />
          </span>
          Ask Lis
        </a>
      </header>
      <div className={`${styles.week} kgSurface`} role="group" aria-label="Choose a day">
        {weekDates(date).map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={date === day}
            aria-label={new Date(day + 'T12:00:00Z').toLocaleDateString('en-PH', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
            })}
            onClick={() => {
              setSelected(day);
              setNotice(null);
            }}
          >
            <span>
              {new Date(day + 'T12:00:00Z').toLocaleDateString('en-PH', {
                weekday: 'short',
                timeZone: 'UTC',
              })}
            </span>
            <b>{Number(day.slice(-2))}</b>
          </button>
        ))}
        <div className={styles.weekActions}>
          {([-7, 7] as const).map((offset) => (
            <button
              key={offset}
              type="button"
              aria-label={offset < 0 ? 'Previous week' : 'Next week'}
              onClick={() => {
                const next = new Date(date + 'T12:00:00Z');
                next.setUTCDate(next.getUTCDate() + offset);
                setSelected(next.toISOString().slice(0, 10));
                setNotice(null);
              }}
            >
              <BotanicalIcon name={offset < 0 ? 'previous' : 'next'} />
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div role="alert" className={styles.notice}>
          {error}{' '}
          <button onClick={() => void refresh()} className={styles.secondary}>
            Retry
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <div className={styles.grid}>
        <section
          className={`${styles.panel} kgSurface`}
          aria-labelledby="plan-title"
        >
          <div className={styles.panelHead}>
            <h2 id="plan-title">{date === today ? "Today's plan" : 'Your plan'}</h2>
            {tasks.length > 0 && (
              <p className={styles.muted}>
                {doneCount} of {tasks.length} done
              </p>
            )}
          </div>
          {!data && !error ? (
            <p role="status" className={styles.muted}>
              Loading your plan…
            </p>
          ) : blocks.length + unscheduled.length === 0 ? (
            <div className={styles.empty}>
              <h3>
                {tasks.length
                  ? 'Room for what comes next.'
                  : 'Start with one small step.'}
              </h3>
              <p>
                {tasks.length
                  ? 'Your scheduled tasks are complete. You can leave it here, or add something new.'
                  : 'Capture something that matters to you. One small step is enough to begin.'}
              </p>
            </div>
          ) : (
            <>
              {nextTitle && (
                <div className={`${styles.nextUp} kgSheen`}>
                  <div className={styles.nextUpBody}>
                    <div className={styles.nextUpText}>
                      <p className="kgEyebrow">
                        {nextTime ? 'Next up · ' + nextTime : 'Next up'}
                      </p>
                      <p className={styles.nextUpTitle}>{nextTitle}</p>
                      <p className={styles.nextUpMeta}>{nextMeta}</p>
                    </div>
                    {/* Only a task can be started here. A workout block or a block
                        with no task behind it is shown, not acted on: the surfaces
                        that own those are off the v1 rail (owner decision,
                        2026-09-19), and Home does not link into them. */}
                    {leadTask ? (
                      <div className={styles.nextUpActions}>
                        <button
                          className="kgAccent"
                          type="button"
                          aria-label={'Start next step: ' + nextTitle}
                          onClick={(event) => {
                            event.currentTarget.focus();
                            setEditing(leadTask);
                          }}
                        >
                          Start
                          <BotanicalIcon name="play" size={14} weight="fill" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
              <ol className={styles.planList}>
                {blocks.map((block) => (
                  <li key={block.id} className={styles.planRow}>
                    <div className={styles.planText}>
                      <p className={styles.planTitle}>{block.title}</p>
                      <p className={styles.planMeta}>
                        {block.end_min - block.start_min} min · Scheduled
                      </p>
                    </div>
                    <span className={styles.planTime}>
                      {minutesToLabel(block.start_min)}
                    </span>
                    {block.source_table === 'tasks' &&
                    tasks.some((task) => task.id === block.source_id) ? (
                      <button
                        className={styles.iconButton}
                        onClick={(event) => {
                          event.currentTarget.focus();
                          setEditing(
                            tasks.find((task) => task.id === block.source_id) ?? null,
                          );
                        }}
                        aria-label={'Edit ' + block.title}
                      >
                        <BotanicalIcon name="next" size={18} />
                      </button>
                    ) : null}
                  </li>
                ))}
                {unscheduled.map((task) => (
                  <li key={task.id} className={styles.planRow}>
                    <div className={styles.planText}>
                      <p className={styles.planTitle}>{task.title}</p>
                      <p className={styles.planMeta}>No time set · Your daily plan</p>
                    </div>
                    <span className={styles.planTime}>Anytime</span>
                    <button
                      onClick={(event) => {
                        event.currentTarget.focus();
                        setEditing(task);
                      }}
                      className={styles.iconButton}
                      aria-label={'Edit ' + task.title}
                    >
                      <BotanicalIcon name="next" size={18} />
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          {/* The composer: the same pill the Lis screen types into, so the
              two places a person writes something look and behave alike. */}
          <form className={styles.capture} onSubmit={capture}>
            <span className={styles.captureMark} aria-hidden="true">
              <BotanicalIcon name="plus" size={18} weight="bold" />
            </span>
            <input
              ref={input}
              aria-label="Capture a thought or task"
              placeholder="Capture a thought or task…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={160}
              disabled={busy || !draftReady}
            />
            <button
              className={styles.captureSend}
              type="submit"
              aria-label="Add task"
              disabled={!draft.trim() || busy}
            >
              <BotanicalIcon name="send" size={18} weight="bold" />
            </button>
          </form>
        </section>
        <div className={styles.side}>
          <section
            className={`${styles.panel} kgSurface`}
            aria-labelledby="priorities-title"
          >
            <div className={styles.panelHead}>
              <h2 id="priorities-title">Priorities</h2>
              <p className={styles.muted}>{date === today ? 'Today' : 'That day'}</p>
            </div>
            <ul className={styles.priorities}>
              {tasks.slice(0, 5).map((task) => (
                <li key={task.id} className={task.completed_at ? styles.done : undefined}>
                  <label className={styles.checkBox}>
                    <input
                      className={styles.check}
                      type="checkbox"
                      aria-label={'Complete ' + task.title}
                      checked={
                        pendingCompletion?.id === task.id
                          ? pendingCompletion.completed
                          : Boolean(task.completed_at)
                      }
                      disabled={busy}
                      onChange={() => void complete(task)}
                    />
                  </label>
                  <button
                    className={styles.taskTitle}
                    onClick={(event) => {
                      event.currentTarget.focus();
                      setEditing(task);
                    }}
                  >
                    {task.title}
                  </button>
                </li>
              ))}
            </ul>
            {data && tasks.length === 0 && (
              <p className={styles.muted}>Your daily tasks will appear here.</p>
            )}
            {tasks.length > 5 && (
              <p className={styles.muted}>
                {tasks.length - 5} more in your plan.
              </p>
            )}
            <div className={styles.actions}>
              <button
                className="kgGhost"
                style={{ width: '100%' }}
                onClick={() => input.current?.focus()}
              >
                <BotanicalIcon name="plus" size={18} />
                Add a task…
              </button>
            </div>
          </section>
          <a className={`${styles.glance} kgSurface`} href="/calories">
            <span className={styles.glanceHead}>
              <BotanicalIcon name="food" size={20} />
              Energy
              <span className={styles.caret}>
                <BotanicalIcon name="next" size={18} />
              </span>
            </span>
            <span className={`${styles.glanceNum} kgNum`}>
              {kcal.toLocaleString('en-PH')}
              <span className={styles.glanceUnit}>kcal logged</span>
            </span>
            <span className={styles.bar} aria-hidden="true">
              <span
                className={styles.barFill}
                style={{ width: Math.min(100, (mealsLogged / 4) * 100) + '%' }}
              />
            </span>
            <span className={styles.glanceMeta}>
              {entries.length
                ? mealsLogged + ' of 4 meals logged'
                : 'Nothing logged yet'}
            </span>
          </a>
          <section className={`${styles.glance} kgSurface`} aria-label="Movement">
            <span className={styles.glanceHead}>
              <BotanicalIcon name="workout" size={20} />
              Movement
            </span>
            <span className={`${styles.glanceNum} kgNum`}>
              {activeDays}
              <span className={styles.glanceUnit}>of the last 7 days</span>
            </span>
            <span className={styles.bar} aria-hidden="true">
              <span
                className={styles.barFill}
                style={{ width: (activeDays / 7) * 100 + '%' }}
              />
            </span>
            <span className={styles.glanceMeta}>
              {activeWorkout
                ? 'Session in progress'
                : completedWorkouts
                  ? completedWorkouts + ' completed today'
                  : 'From your recorded sessions'}
            </span>
          </section>
        </div>
      </div>
      {editing && (
        <TaskEditor
          task={editing}
          userId={userId}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
