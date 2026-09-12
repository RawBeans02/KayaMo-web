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
      setNotice('Could not save this task. Your draft is still here—please retry.');
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
      <header className={styles.header + ' ' + styles.homeHeader}>
        <div>
          <h1 id="home-title">Home</h1>
          <p className={styles.homeDate}>
            {new Date(date + 'T12:00:00Z').toLocaleDateString('en-PH', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
          <p>{clock.timeZone.split('/').pop()?.replaceAll('_', ' ')}</p>
        </div>
        <a className={styles.ask} href="/mus">
          <img src="/botanical/mus-neutral.webp" width="52" height="52" alt="" />
          Ask Mus
        </a>
      </header>
      <div className={styles.week} role="group" aria-label="Choose a day">
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
          className={styles.panel + ' ' + styles.plan}
          aria-labelledby="plan-title"
        >
          <h2 id="plan-title">{date === today ? "Today's plan" : 'Your plan'}</h2>
          <p className={styles.muted}>A few meaningful steps for a better day.</p>
          {!data && !error ? (
            <p role="status" className={styles.empty}>
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
                  : 'Capture something that matters to you. Set a time in the full planner when you need one.'}
              </p>
              <a href="/todos" className={styles.secondary}>
                Open planner
                <BotanicalIcon name="arrow" size={18} />
              </a>
            </div>
          ) : (
            <ol className={styles.timeline}>
              {blocks.map((block, index) => (
                <li key={block.id}>
                  <span className={styles.time}>{minutesToLabel(block.start_min)}</span>
                  <div className={styles.activity}>
                    <span className={styles.activityIcon}>
                      <BotanicalIcon
                        name={block.source_table === 'workouts' ? 'workout' : 'book'}
                      />
                    </span>
                    <div className={styles.activityText}>
                      <strong>{block.title}</strong>
                      <small>{block.end_min - block.start_min} min · Scheduled</small>
                    </div>
                    {block.source_table === 'tasks' &&
                    tasks.some((task) => task.id === block.source_id) ? (
                      <button
                        className={index === 0 ? styles.primary : styles.iconButton}
                        onClick={() =>
                          setEditing(
                            tasks.find((task) => task.id === block.source_id) ?? null,
                          )
                        }
                        aria-label={
                          index === 0
                            ? 'Start next step: ' + block.title
                            : 'Open ' + block.title
                        }
                      >
                        {index === 0 ? 'Start next step' : null}
                        <BotanicalIcon name="next" size={18} />
                      </button>
                    ) : (
                      <a
                        href={block.source_table === 'workouts' ? '/gym' : '/todos'}
                        className={styles.iconButton}
                        aria-label={'Open ' + block.title}
                      >
                        <BotanicalIcon name="next" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
              {unscheduled.map((task, index) => (
                <li key={task.id}>
                  <span className={styles.time}>{index === 0 ? 'Anytime' : ''}</span>
                  <div className={styles.activity}>
                    <span className={styles.activityIcon}>
                      <BotanicalIcon name="tasks" />
                    </span>
                    <div className={styles.activityText}>
                      <strong>{task.title}</strong>
                      <small>No time set · Your daily plan</small>
                    </div>
                    <button
                      onClick={() => setEditing(task)}
                      className={styles.iconButton}
                      aria-label={'Edit ' + task.title}
                    >
                      <BotanicalIcon name="next" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <form className={styles.capture} onSubmit={capture}>
            <BotanicalIcon name="plus" />
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
              className={styles.iconButton}
              type="submit"
              aria-label="Add task"
              disabled={!draft.trim() || busy}
            >
              <BotanicalIcon name="arrow" />
            </button>
          </form>
          <div className={styles.actions}>
            <a href="/todos" className={styles.muted}>
              Open full planner
            </a>
          </div>
        </section>
        <div className={styles.side}>
          <section className={styles.panel} aria-labelledby="priorities-title">
            <h2 id="priorities-title">Priorities</h2>
            <p className={styles.muted}>
              Focus on what matters {date === today ? 'today' : 'that day'}.
            </p>
            <ul className={styles.priorities}>
              {tasks.slice(0, 5).map((task) => (
                <li key={task.id} className={task.completed_at ? styles.done : undefined}>
                  <input
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
                  <button className={styles.taskTitle} onClick={() => setEditing(task)}>
                    {task.title}
                  </button>
                </li>
              ))}
            </ul>
            {data && tasks.length === 0 && (
              <p className={styles.muted}>Your daily tasks will appear here.</p>
            )}
            {tasks.length > 5 && (
              <a href="/todos" className={styles.tool}>
                View all {tasks.length} tasks
                <BotanicalIcon name="next" />
              </a>
            )}
            <button
              className={styles.secondary}
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => input.current?.focus()}
            >
              <BotanicalIcon name="plus" size={18} />
              Add a task…
            </button>
          </section>
          <section className={styles.panel} aria-labelledby="tools-title">
            <h2 id="tools-title">Other tools</h2>
            <p className={styles.muted}>Quick access, no extra noise.</p>
            <a href="/calories" className={styles.tool}>
              <BotanicalIcon name="food" />
              <span>
                Food diary
                <small className={styles.muted} style={{ display: 'block' }}>
                  {entries.length
                    ? entries.length + ' items logged'
                    : 'Nothing logged yet'}
                </small>
              </span>
              <BotanicalIcon name="next" size={18} />
            </a>
            <a href="/gym" className={styles.tool}>
              <BotanicalIcon name="workout" />
              <span>
                {activeWorkout ? 'Continue workout' : 'Workout log'}
                <small className={styles.muted} style={{ display: 'block' }}>
                  {activeWorkout
                    ? 'Session in progress'
                    : completedWorkouts
                      ? completedWorkouts + ' completed'
                      : 'Ready when you are'}
                </small>
              </span>
              <BotanicalIcon name="next" size={18} />
            </a>
            <div className={styles.encouragement}>
              <img src="/botanical/seed-mark.webp" width="40" height="40" alt="" />
              <p>
                Small steps.
                <br />
                Room to grow at your pace.
              </p>
            </div>
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
