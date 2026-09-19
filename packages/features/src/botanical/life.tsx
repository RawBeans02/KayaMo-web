'use client';
import {
  listLocalCompanionEvents,
  listLocalFoodLedger,
  listLocalGoalMilestones,
  listLocalGoals,
  listLocalTasks,
  listLocalWorkoutHistory,
  logicalDateFromInstant,
} from '@kayamo/offline';
import { useCallback } from 'react';
import { useDeskClock } from '../desk/use-desk-clock';
import { BarChart } from './charts';
import { BotanicalIcon, type BotanicalIconName } from './icons';
import {
  countByDay,
  countInRange,
  currentRun,
  inMonth,
  lastDays,
  series,
  shortDate,
  sumByDay,
  weekBuckets,
} from './progress-model';
import { useRecords } from './use-records';
import styles from './botanical.module.css';
import progressStyles from './progress.module.css';

/**
 * Life is the record and the hub. The top half reads back what the person
 * has done, from the same local records every other screen writes: confirmed
 * steps per day, food logged per day, tasks done, workouts per week, and a
 * strip of readings. The bottom half is the map to the food and growth
 * screens. Nothing here is a target to hit or a streak to keep; the copy
 * says what happened.
 *
 * Workouts are off this hub for the first release (owner decision,
 * 2026-09-18); the chart still counts the sessions already recorded.
 */
const physical: { href: string; icon: BotanicalIconName; title: string; meta: string }[] =
  [
    {
      href: '/calories',
      icon: 'food',
      title: 'Food diary',
      meta: 'What you ate, with the source kept on every entry',
    },
    {
      href: '/foods',
      icon: 'book',
      title: 'Food catalog',
      meta: 'The foods and servings your diary draws from',
    },
    {
      href: '/verify',
      icon: 'tasks',
      title: 'Food verification',
      meta: 'Check a food before it becomes a number you trust',
    },
  ];

const growth: { href: string; icon: BotanicalIconName; title: string; meta: string }[] = [
  {
    href: '/goals',
    icon: 'goals',
    title: 'Goals',
    meta: 'One today-sized step at a time',
  },
  {
    href: '/grove',
    icon: 'grove',
    title: 'Grove',
    meta: 'Milestones, records and the trail of what you have done',
  },
];

const STEP_DAYS = 28;
const FOOD_DAYS = 14;
const TASK_DAYS = 14;
const WORKOUT_WEEKS = 8;

export function BotanicalLife({ userId }: { userId: string }) {
  const { clock, today } = useDeskClock(userId);
  const load = useCallback(async () => {
    const [events, ledger, tasks, workouts, goals] = await Promise.all([
      listLocalCompanionEvents(userId),
      listLocalFoodLedger(userId),
      listLocalTasks(userId),
      listLocalWorkoutHistory(userId),
      listLocalGoals(userId),
    ]);
    const milestones = (
      await Promise.all(goals.map((goal) => listLocalGoalMilestones(userId, goal.id)))
    ).flat();
    return { events, ledger, tasks, workouts, goals, milestones };
  }, [userId]);
  const { data, error, refresh } = useRecords(load);

  const stepDays = lastDays(today, STEP_DAYS);
  const foodDays = lastDays(today, FOOD_DAYS);
  const taskDays = lastDays(today, TASK_DAYS);
  const weeks = weekBuckets(today, WORKOUT_WEEKS);

  const eventDates = (data?.events ?? []).map((event) => event.logical_date);
  const stepsByDay = countByDay(eventDates);
  const stepDates = new Set(eventDates);
  const kcalByDay = sumByDay(
    (data?.ledger ?? []).map((row) => ({ date: row.logical_date, value: Number(row.kcal) || 0 })),
  );
  const foodDates = new Set((data?.ledger ?? []).map((row) => row.logical_date));
  const taskDoneDates = (data?.tasks ?? [])
    .filter((task) => task.completed_at)
    .map((task) => logicalDateFromInstant(task.completed_at!, clock.timeZone, clock.dayStartsAt));
  const tasksByDay = countByDay(taskDoneDates);
  const workoutDates = (data?.workouts ?? [])
    .filter((workout) => workout.status === 'completed')
    .map((workout) => workout.logical_date);
  const workoutsByWeek = weeks.map((week) => countInRange(workoutDates, week.start, week.end));

  const run = currentRun(stepDates, today);
  const stepsThisMonth = eventDates.filter((date) => inMonth(date, today)).length;
  const foodDaysThisMonth = [...foodDates].filter((date) => inMonth(date, today)).length;
  const workoutsThisMonth = workoutDates.filter((date) => inMonth(date, today)).length;
  const activeGoals = (data?.goals ?? []).filter((goal) => goal.status === 'active').length;
  const stepsConfirmed = (data?.milestones ?? []).filter((row) => row.completed_at).length;

  const readings = [
    { value: run, unit: run === 1 ? 'day' : 'days', label: 'in a row with a confirmed step' },
    { value: stepsThisMonth, unit: '', label: 'steps confirmed this month' },
    { value: foodDaysThisMonth, unit: '', label: 'days with food logged this month' },
    { value: workoutsThisMonth, unit: '', label: 'workouts recorded this month' },
    {
      value: activeGoals,
      unit: activeGoals === 1 ? 'goal' : 'goals',
      label: stepsConfirmed
        ? `in progress · ${stepsConfirmed} ${stepsConfirmed === 1 ? 'step' : 'steps'} confirmed`
        : 'in progress',
    },
  ];

  const every = (n: number, length: number) =>
    Array.from({ length }, (_, i) => i).filter((i) => i % n === 0);
  const nothingYet =
    Boolean(data) &&
    eventDates.length + foodDates.size + taskDoneDates.length + workoutDates.length === 0;

  return (
    <section className={styles.page} aria-labelledby="life-title">
      <header className={styles.header}>
        <div>
          <h1 id="life-title" className="kgTitle">
            Life
          </h1>
          <p className={styles.lede}>
            What you have done, from your own records, and the places you do it.
          </p>
        </div>
      </header>

      {error && (
        <p role="alert" className={styles.notice}>
          {error}
          <button className={styles.secondary} onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      )}

      {nothingYet ? (
        <p className={styles.notice} role="status">
          Nothing recorded yet. The first task you tick off on Home, the first food you
          log, shows up here the same day.
          <a className="kgGhost" href="/today">
            Go to Home
          </a>
        </p>
      ) : null}

      <div className={progressStyles.readings} aria-label="Readings" role="list">
        {readings.map((reading) => (
          <div key={reading.label} className={`${progressStyles.reading} kgSurface`} role="listitem">
            <span className={`${progressStyles.readingNum} kgNum`}>
              {data ? reading.value : '–'}
              {reading.unit ? <span className={progressStyles.readingUnit}>{reading.unit}</span> : null}
            </span>
            <span className={progressStyles.readingLabel}>{reading.label}</span>
          </div>
        ))}
      </div>

      <div className={progressStyles.charts}>
        <section className={`${progressStyles.chartCard} kgSurface`} aria-labelledby="life-steps-title">
          <div className={progressStyles.chartHead}>
            <h2 id="life-steps-title">Confirmed steps</h2>
            <p>Last {STEP_DAYS} days</p>
          </div>
          <BarChart
            values={series(stepDays, stepsByDay)}
            labels={stepDays.map(shortDate)}
            ticks={every(7, STEP_DAYS)}
            ariaLabel={`Confirmed steps per day, last ${STEP_DAYS} days`}
          />
          <p className={progressStyles.chartFoot}>
            Tasks, goal steps, workouts and food logs you confirmed. A quiet day is an
            empty bar, nothing more.
          </p>
        </section>

        <section className={`${progressStyles.chartCard} kgSurface`} aria-labelledby="life-food-title">
          <div className={progressStyles.chartHead}>
            <h2 id="life-food-title">Food logged</h2>
            <p>Last {FOOD_DAYS} days</p>
          </div>
          <BarChart
            values={series(foodDays, kcalByDay).map(Math.round)}
            labels={foodDays.map(shortDate)}
            ticks={every(7, FOOD_DAYS)}
            ariaLabel={`Kilocalories logged per day, last ${FOOD_DAYS} days`}
            formatValue={(value) => `${value.toLocaleString('en-PH')} kcal`}
          />
          <p className={progressStyles.chartFoot}>
            Energy from the entries in your diary, with each entry&rsquo;s source kept.
            Days you did not log show empty.
          </p>
        </section>

        <section className={`${progressStyles.chartCard} kgSurface`} aria-labelledby="life-tasks-title">
          <div className={progressStyles.chartHead}>
            <h2 id="life-tasks-title">Tasks done</h2>
            <p>Last {TASK_DAYS} days</p>
          </div>
          <BarChart
            values={series(taskDays, tasksByDay)}
            labels={taskDays.map(shortDate)}
            ticks={every(7, TASK_DAYS)}
            ariaLabel={`Tasks completed per day, last ${TASK_DAYS} days`}
          />
          <p className={progressStyles.chartFoot}>Ticked off on Home, counted on the day you ticked them.</p>
        </section>

        <section className={`${progressStyles.chartCard} kgSurface`} aria-labelledby="life-workouts-title">
          <div className={progressStyles.chartHead}>
            <h2 id="life-workouts-title">Workouts</h2>
            <p>Last {WORKOUT_WEEKS} weeks</p>
          </div>
          <BarChart
            values={workoutsByWeek}
            labels={weeks.map((week) => `${shortDate(week.start)}–${shortDate(week.end)}`)}
            ariaLabel={`Workouts completed per week, last ${WORKOUT_WEEKS} weeks`}
          />
          <p className={progressStyles.chartFoot}>Sessions you finished, by week.</p>
        </section>
      </div>

      <div className={styles.cards}>
        <section
          className={`${styles.panel} kgSurface`}
          aria-labelledby="life-physical-title"
        >
          <div className={styles.panelHead}>
            <h2 id="life-physical-title">Physical self</h2>
          </div>
          {physical.map((item) => (
            <a className={styles.tool} href={item.href} key={item.href}>
              <BotanicalIcon name={item.icon} size={22} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <BotanicalIcon name="next" size={18} />
            </a>
          ))}
        </section>
        <section
          className={`${styles.panel} kgSurface`}
          aria-labelledby="life-growth-title"
        >
          <div className={styles.panelHead}>
            <h2 id="life-growth-title">Your wider life</h2>
          </div>
          {growth.map((item) => (
            <a className={styles.tool} href={item.href} key={item.href}>
              <BotanicalIcon name={item.icon} size={22} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <BotanicalIcon name="next" size={18} />
            </a>
          ))}
        </section>
      </div>
    </section>
  );
}
