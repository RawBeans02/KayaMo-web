'use client';

import {
  createLocalTask,
  listLocalGoals,
  listLocalTasksForDate,
  listLocalTimeBlocks,
  listLocalWorkoutHistory,
  setLocalTaskCompleted,
  type LocalTask,
  useLiveFoodEntries,
  useLiveFoodLedger,
} from '@kayamo/offline';
import { createBrowserSupabase, listEffectiveNutritionTargets } from '@kayamo/db';
import { MEAL_SLOTS } from '@kayamo/food/quick-log';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useDeskClock } from '../desk/use-desk-clock';
import { pickHeadlineTarget, type TargetRow } from '../food/week-headline';
import { minutesToLabel, weekDates } from '../todo/timetable';
import { ProgressRing } from './charts';
import { homeGreeting, streakLabel } from './greeting';
import { BotanicalIcon } from './icons';
import { currentRun, shiftDay } from './progress-model';
import { useRecords } from './use-records';
import { TaskEditor } from './task-editor';
import styles from './botanical.module.css';

/** The last seven logical days ending on `date`, inclusive. */
function windowStart(date: string) {
  const start = new Date(date + 'T12:00:00Z');
  start.setUTCDate(start.getUTCDate() - 6);
  return start.toISOString().slice(0, 10);
}

/** The person's local hour, from the same clock the logical day comes from. */
function localHour(nowMs: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone,
    }).formatToParts(new Date(nowMs));
    return Number(parts.find((part) => part.type === 'hour')?.value ?? 12);
  } catch {
    return new Date(nowMs).getHours();
  }
}

export function BotanicalHome({ userId }: { userId: string }) {
  const { clock, today, nowMs } = useDeskClock(userId);
  const guest = userId.startsWith('guest-');
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<LocalTask | null>(null);
  const date = selected ?? today;
  const load = useCallback(async () => {
    const [tasks, blocks, workouts, goals] = await Promise.all([
      listLocalTasksForDate(userId, date),
      listLocalTimeBlocks(userId, date),
      listLocalWorkoutHistory(userId),
      listLocalGoals(userId),
    ]);
    return { tasks, blocks, workouts, goals };
  }, [userId, date]);
  const { data, error, refresh } = useRecords(load);
  const entries = useLiveFoodEntries(userId, date);
  const ledger = useLiveFoodLedger(userId);

  /* ── What Lis knows about the person: a name and a target, both optional.
        Guests have neither; a signed-in person has them once onboarding and
        the companion profile are filled in. Nothing here blocks the page. ── */
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  useEffect(() => {
    if (guest) return;
    let cancelled = false;
    void listEffectiveNutritionTargets(createBrowserSupabase(), { userId, date: today })
      .then((rows) => {
        if (!cancelled) setTargetRows(rows);
      })
      .catch(() => {
        if (!cancelled) setTargetRows([]);
      });
    void fetch('/api/mus/profile')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { display_name?: string | null } | null) => {
        if (!cancelled) setDisplayName(body?.display_name?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setDisplayName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [guest, today, userId]);
  const targetKcal = useMemo(() => pickHeadlineTarget(targetRows)?.kcal ?? null, [targetRows]);
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
  const loggedDates = useMemo(
    () => new Set(ledger.map((row) => String(row.logical_date))),
    [ledger],
  );
  const yesterday = shiftDay(today, -1);
  const yesterdayKcal = useMemo(() => {
    const rows = ledger.filter((row) => String(row.logical_date) === yesterday);
    return rows.length
      ? Math.round(rows.reduce((sum, row) => sum + (Number(row.kcal) || 0), 0))
      : null;
  }, [ledger, yesterday]);
  const run = currentRun(loggedDates, today);
  const greeting =
    date === today
      ? homeGreeting({
          name: displayName,
          today,
          hour: localHour(nowMs, clock.timeZone),
          todayKcal: kcal,
          mealsLogged,
          targetKcal,
          loggedDates,
          yesterdayKcal,
        })
      : null;
  const kcalFraction = targetKcal ? Math.min(1, kcal / targetKcal) : 0;
  const kcalText = entries.length
    ? targetKcal
      ? kcal.toLocaleString('en-PH') + ' of ' + targetKcal.toLocaleString('en-PH') + ' kcal'
      : kcal.toLocaleString('en-PH') + ' kcal logged, no target yet'
    : 'Nothing logged yet';
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
            {greeting?.dateNote ? ' · ' + greeting.dateNote : ''}
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
      {greeting ? (
        /* Lis speaks first, once a day, from the person's own records only:
           no model call, no memory, and never about a missed day. */
        <div className={styles.greeting} data-home-greeting={greeting.kind}>
          <img
            className={styles.greetingAvatar}
            src="/botanical/lis-bee.webp"
            alt=""
            width={48}
            height={48}
          />
          <p className={styles.greetingText}>{greeting.text}</p>
        </div>
      ) : null}
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
      {/* Readings: the ring only ever fills, the counter only ever adds, and
          the streak names a run, never a debt (the evidence brief's "additive,
          never depleting" rule). */}
      <div className={styles.readings} data-home-readings="">
        <a className={`${styles.reading} ${styles.readingRing} kgSurface`} href="/calories">
          <span
            className={styles.ringWrap}
            role="meter"
            aria-label="Calories today"
            aria-valuemin={0}
            aria-valuemax={targetKcal ?? undefined}
            aria-valuenow={kcal}
            aria-valuetext={kcalText}
          >
            <ProgressRing fraction={kcalFraction} size={72} />
            <span className={`${styles.ringValue} kgNum`}>
              {targetKcal ? Math.round(kcalFraction * 100) + '%' : '—'}
            </span>
          </span>
          <span className={styles.readingBody}>
            <span className={styles.readingLabel}>Calories</span>
            <span className={`${styles.readingNum} kgNum`}>
              {kcal.toLocaleString('en-PH')}
              <span className={styles.readingOf}>
                {targetKcal ? 'of ' + targetKcal.toLocaleString('en-PH') : 'kcal'}
              </span>
            </span>
            <span className={styles.readingMeta}>
              {targetKcal
                ? entries.length
                  ? 'From your confirmed entries'
                  : 'Nothing logged yet'
                : 'No target yet · one comes with your profile'}
            </span>
          </span>
        </a>
        <section className={`${styles.reading} kgSurface`} aria-label="Meals logged">
          <span className={styles.readingLabel}>Meals logged</span>
          <span className={`${styles.readingNum} kgNum`}>
            {mealsLogged}
            <span className={styles.readingOf}>of {MEAL_SLOTS.length}</span>
          </span>
          <span className={styles.readingMeta}>
            {mealsLogged === 0
              ? 'First meal whenever you like'
              : mealsLogged >= MEAL_SLOTS.length
                ? 'Every slot has something in it'
                : MEAL_SLOTS.length - mealsLogged + ' still to come'}
          </span>
        </section>
        <section className={`${styles.reading} kgSurface`} aria-label="Streak">
          <span className={styles.readingLabel}>Streak</span>
          <span
            className={styles.streakChip}
            data-live={run > 0 ? 'true' : 'false'}
            data-home-streak={run}
          >
            <span className={styles.streakDot} aria-hidden="true" />
            <span>{streakLabel(run, loggedDates.size > 0)}</span>
          </span>
          <span className={styles.readingMeta}>Days with something logged</span>
        </section>
      </div>
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
            {data && data.goals.length === 0 && (
              <a href="/goals" className={styles.tool} data-home-goal-nudge="">
                <BotanicalIcon name="goals" size={22} />
                <span>
                  <strong>Start your first goal</strong>
                  <small>One thing worth working toward, one step at a time.</small>
                </span>
                <BotanicalIcon name="next" size={18} />
              </a>
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
