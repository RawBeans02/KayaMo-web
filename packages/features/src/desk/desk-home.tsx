'use client';

import { createBrowserSupabase, listEffectiveNutritionTargets, type NutritionTarget } from '@kayamo/db';
import {
  listLocalOpenTasks,
  listLocalTasksForDate,
  listLocalWorkoutHistory,
  recoverClosedOfflineDb,
  useLiveFoodEntries,
  useLiveFoodHistory,
  type LocalTask,
  type LocalWorkout,
} from '@kayamo/offline';
import { useEffect, useMemo, useState } from 'react';
import {
  mondayOfLogicalWeek,
  pickHeadlineTarget,
  weekDaySeries,
  weekHeadline,
  weekKcalBars,
} from '../food/week-headline';
import { MusThread } from '../screens/mus-thread';
import styles from '../food/desk.module.css';
import { DeskBarChart, DeskMacroChart } from './desk-charts';
import { useDeskClock } from './use-desk-clock';

export function DeskHome({ userId }: { userId: string }) {
  const { clock, today } = useDeskClock(userId);
  const entries = useLiveFoodEntries(userId, today);
  const history = useLiveFoodHistory(userId);
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [openTasks, setOpenTasks] = useState<LocalTask[]>([]);
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [weekWorkouts, setWeekWorkouts] = useState<LocalWorkout[]>([]);
  const [targetRows, setTargetRows] = useState<NutritionTarget[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await recoverClosedOfflineDb(async () => {
          const [dayTasks, inbox, sessions] = await Promise.all([
            listLocalTasksForDate(userId, today),
            listLocalOpenTasks(userId),
            listLocalWorkoutHistory(userId),
          ]);
          if (cancelled) return;
          const monday = mondayOfLogicalWeek(today);
          setTasks(dayTasks);
          setOpenTasks(inbox);
          setWorkouts(sessions.filter((row) => row.logical_date === today));
          setWeekWorkouts(
            sessions.filter((row) => row.logical_date >= monday && row.logical_date <= today),
          );
        });
      } catch {
        // IndexedDB can close during auth/scope switch; the next tick retries.
      }
    }
    void load();
    const onVis = () => void load();
    document.addEventListener('visibilitychange', onVis);
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(timer);
    };
  }, [today, userId]);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    void listEffectiveNutritionTargets(client, { userId, date: today })
      .then((rows) => {
        if (!cancelled) setTargetRows(rows);
      })
      .catch(() => {
        if (!cancelled) setTargetRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [today, userId]);

  const headline = useMemo(
    () =>
      weekHeadline({
        today,
        entries: history,
        target: pickHeadlineTarget(targetRows),
      }),
    [history, targetRows, today],
  );

  const kcalBars = useMemo(() => weekKcalBars(today, history), [history, today]);
  const gymBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of weekWorkouts) {
      if (row.status !== 'completed') continue;
      counts.set(row.logical_date, (counts.get(row.logical_date) ?? 0) + 1);
    }
    return weekDaySeries(today, counts);
  }, [today, weekWorkouts]);

  const todayKcal = Math.round(
    entries.reduce((sum, row) => sum + (Number(row.kcal) || 0), 0),
  );
  const proteinG = entries.reduce((sum, row) => sum + (Number(row.protein_g) || 0), 0);
  const carbsG = entries.reduce((sum, row) => sum + (Number(row.carbs_g) || 0), 0);
  const fatG = entries.reduce((sum, row) => sum + (Number(row.fat_g) || 0), 0);
  const openToday = tasks.filter((row) => !row.completed_at);
  const activeGym = workouts.find((row) => row.status === 'active') ?? null;
  const remainingCopy =
    headline.targetKcal === null
      ? 'No calorie target yet'
      : headline.over
        ? `${Math.abs(headline.remainingKcal ?? 0).toLocaleString('en-PH')} over · from this week's target`
        : `${(headline.remainingKcal ?? 0).toLocaleString('en-PH')} left · from this week's target`;

  return (
    <section className={`${styles.panel} ${styles.dashboard}`} aria-labelledby="dash-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Dashboard</p>
          <h1 id="dash-title" className={styles.title}>
            Today
          </h1>
        </div>
        <p className={styles.headerAside}>
          {today}. ⌘K logs food. Lis on the right can propose a todo or a goal. Nothing
          writes until you confirm.
        </p>
      </header>

      <div className={styles.dashSplit}>
        <div className={styles.dashMain}>
          <div className={styles.headline}>
            <div>
              <p className={styles.statLabel}>This week's average</p>
              <p className={styles.statValue}>
                {headline.weekAverageKcal === null
                  ? '—'
                  : headline.weekAverageKcal.toLocaleString('en-PH')}
              </p>
              <p className={styles.statNote}>
                {headline.daysLogged === 0
                  ? 'No days logged this week yet'
                  : `${headline.daysLogged} day${headline.daysLogged === 1 ? '' : 's'} logged`}
              </p>
            </div>
            <div>
              <p className={styles.statLabel}>Today remaining</p>
              <p className={styles.statValue}>
                {headline.targetKcal === null
                  ? '—'
                  : Math.abs(headline.remainingKcal ?? 0).toLocaleString('en-PH')}
              </p>
              <p className={styles.statNote}>{remainingCopy}</p>
            </div>
          </div>

          <div className={styles.chartRow}>
            <DeskBarChart caption="kcal this week" bars={kcalBars} unit="kcal" />
            <DeskBarChart caption="sessions this week" bars={gymBars} unit="sessions" />
            <DeskMacroChart proteinG={proteinG} carbsG={carbsG} fatG={fatG} />
          </div>

          <div className={styles.dashGrid}>
            <a className={styles.dashCard} href="/calories">
              <p className={styles.statLabel}>Calories</p>
              <p className={styles.dashMetric}>{todayKcal.toLocaleString('en-PH')} kcal</p>
              <p className={styles.statNote}>
                {entries.length === 0
                  ? 'Nothing logged. ⌘K to add a meal.'
                  : `${entries.length} ${entries.length === 1 ? 'item' : 'items'} today`}
              </p>
            </a>
            <a className={styles.dashCard} href="/todos">
              <p className={styles.statLabel}>Todos</p>
              <p className={styles.dashMetric}>{openToday.length} open</p>
              <p className={styles.statNote}>
                {openToday[0]
                  ? openToday[0].title
                  : openTasks[0]
                    ? `Inbox: ${openTasks[0].title}`
                    : 'Add one on Todos, or ask Lis.'}
              </p>
            </a>
            <a className={styles.dashCard} href="/gym">
              <p className={styles.statLabel}>Gym</p>
              <p className={styles.dashMetric}>
                {activeGym ? 'In session' : workouts.length > 0 ? 'Done' : '—'}
              </p>
              <p className={styles.statNote}>
                {activeGym
                  ? 'Open Gym to add a set or finish.'
                  : workouts.length > 0
                    ? `${workouts.length} session${workouts.length === 1 ? '' : 's'} today`
                    : 'Start a session on Gym. Pick from the lift list.'}
              </p>
            </a>
          </div>
          <p className={styles.note}>
            Day boundary {clock.dayStartsAt} · {clock.timeZone}. Grove stays off this
            desktop for now.
          </p>
        </div>
        <aside className={styles.dashMus} aria-label="Lis">
          <MusThread
            userId={userId}
            logicalDate={today}
            recommended={null}
            compact
            entry={{ module: 'dashboard', view: 'today', selectedIds: [] }}
          />
        </aside>
      </div>
    </section>
  );
}
