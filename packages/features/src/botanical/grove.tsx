'use client';
import type { CompanionEventType, CompanionProgression } from '@kayamo/core';
import { listLocalCompanionEvents, listLocalGoals, listLocalTasks } from '@kayamo/offline';
import { useCallback } from 'react';
import { useDeskClock } from '../desk/use-desk-clock';
import { ProgressRing } from './charts';
import { BotanicalIcon } from './icons';
import {
  achievementStandings,
  bestWeek,
  countByDay,
  currentRun,
  firstDate,
  inMonth,
  longDate,
  longestRun,
  progressionOf,
  shortDate,
  stageProgress,
} from './progress-model';
import { useRecords } from './use-records';
import styles from './botanical.module.css';
import progressStyles from './progress.module.css';

/**
 * What a person reads for a stored key. The keys are frozen identifiers in the
 * ledger and the progression schema; these are the words.
 */
const STAGE_LABEL: Record<CompanionProgression['stageKey'], string> = {
  seed: 'Seed',
  sprout: 'Sprout',
  sapling: 'Sapling',
  young_tree: 'Young tree',
  flourishing_tree: 'Flourishing tree',
};

const EVENT_LABEL: Record<CompanionEventType, string> = {
  task_completed: 'Task completed',
  routine_completed: 'Routine completed',
  habit_completed: 'Habit completed',
  milestone_completed: 'Milestone completed',
  goal_completed: 'Goal reached',
  workout_completed: 'Workout completed',
  food_logged: 'Food logged',
  recovery_return: 'Came back after a pause',
};

function eventLabel(type: string): string {
  return (EVENT_LABEL as Record<string, string>)[type] ?? type.replaceAll('_', ' ');
}

function monthCells(dates: Set<string>, today: string) {
  const month = today.slice(0, 7);
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  const length = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return Array.from({ length }, (_, i) => {
    const iso = month + '-' + String(i + 1).padStart(2, '0');
    return { iso, day: i + 1, planted: dates.has(iso), today: iso === today };
  });
}

function monthKey(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Grove is the record: where you stand, the milestones you have reached,
 * your personal records, this month day by day, and the trail of every step
 * you confirmed. It reads only the confirmed ledger. Text and shape, no tree
 * (decision, 2026-09-19), and nothing here ever goes backwards: a quiet day
 * is a grey cell, and the run simply starts again.
 */
export function BotanicalGrove({ userId }: { userId: string }) {
  const { today } = useDeskClock(userId);
  const load = useCallback(async () => {
    const [events, tasks, goals] = await Promise.all([
      listLocalCompanionEvents(userId),
      listLocalTasks(userId),
      listLocalGoals(userId),
    ]);
    return { events, tasks, goals };
  }, [userId]);
  const { data, error, refresh } = useRecords(load);

  const events = data?.events ?? [];
  const eventDates = events.map((event) => event.logical_date);
  const dates = new Set(eventDates);
  const byDay = countByDay(eventDates);
  const progression = progressionOf(events);
  const stage = stageProgress(progression.totalPoints);
  const run = currentRun(dates, today);
  const best = longestRun(dates);
  const busiest = bestWeek(byDay);
  const first = firstDate(dates);
  const cells = monthCells(dates, today);
  const planted = cells.filter((cell) => cell.planted).length;
  const stepsThisMonth = eventDates.filter((date) => inMonth(date, today)).length;
  const standings = achievementStandings(events);
  const reached = standings.filter((row) => row.reachedOn).length;

  const ordered = events
    .slice()
    .sort(
      (a, b) =>
        b.logical_date.localeCompare(a.logical_date) || b.created_at.localeCompare(a.created_at),
    );
  const groups: { month: string; rows: typeof ordered }[] = [];
  for (const event of ordered) {
    const month = monthKey(event.logical_date);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.rows.push(event);
    else groups.push({ month, rows: [event] });
  }

  const readings = [
    { value: run, unit: run === 1 ? 'day' : 'days', label: 'in a row with a confirmed step' },
    { value: planted, unit: `of ${cells.length}`, label: 'days with a step this month' },
    { value: dates.size, unit: '', label: 'days with a step, in total' },
    { value: `${reached}`, unit: `of ${standings.length}`, label: 'milestones reached' },
  ];

  const records = [
    {
      label: 'Longest run',
      value: `${best.length} ${best.length === 1 ? 'day' : 'days'}`,
      when: best.endedOn ? `ended ${shortDate(best.endedOn)}` : 'no run yet',
    },
    {
      label: 'Busiest week',
      value: `${busiest.count} ${busiest.count === 1 ? 'step' : 'steps'}`,
      when: busiest.endedOn ? `week ending ${shortDate(busiest.endedOn)}` : 'no steps yet',
    },
    {
      label: 'First step',
      value: first ? shortDate(first) : '–',
      when: first ? longDate(first) : 'still ahead of you',
    },
    {
      label: 'Points, all time',
      value: String(progression.totalPoints),
      when: 'from confirmed records only',
    },
  ];

  return (
    <section className={styles.page} aria-labelledby="grove-title">
      <header className={styles.header}>
        <div>
          <h1 id="grove-title" className="kgTitle">
            Grove
          </h1>
          <p className={styles.lede}>
            Milestones, records and the trail of what you have done. Quiet days take
            nothing away.
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
      {!data ? (
        <p role="status" className={styles.muted}>
          Loading your history…
        </p>
      ) : (
        <div className={styles.stack}>
          <section className={`${styles.streak} kgSurface kgSheen`} aria-labelledby="grove-stage-title">
            <div className={`${styles.streakBody} ${progressStyles.stage}`}>
              <ProgressRing fraction={stage.fraction} size={72} />
              <div className={progressStyles.stageBody}>
                <p className="kgEyebrow" id="grove-stage-title">
                  Your stage
                </p>
                <p className={progressStyles.stageName}>{STAGE_LABEL[stage.current]}</p>
                <p className={progressStyles.stageNote}>
                  {stage.next
                    ? `${progression.totalPoints} points · ${stage.span - stage.into} more to ${STAGE_LABEL[stage.next]}.`
                    : `${progression.totalPoints} points · the last stage there is.`}{' '}
                  Points come only from steps you confirmed, and never go down.
                </p>
              </div>
            </div>
          </section>

          <div className={progressStyles.readings} aria-label="Readings" role="list">
            {readings.map((reading) => (
              <div key={reading.label} className={`${progressStyles.reading} kgSurface`} role="listitem">
                <span className={`${progressStyles.readingNum} kgNum`}>
                  {reading.value}
                  {reading.unit ? (
                    <span className={progressStyles.readingUnit}>{reading.unit}</span>
                  ) : null}
                </span>
                <span className={progressStyles.readingLabel}>{reading.label}</span>
              </div>
            ))}
          </div>

          <section className={`${styles.panel} kgSurface`} aria-labelledby="grove-milestones-title">
            <div className={styles.panelHead}>
              <h2 id="grove-milestones-title">Milestones</h2>
              <p className={styles.muted}>
                {reached} of {standings.length} reached
              </p>
            </div>
            <ul className={progressStyles.badges}>
              {standings.map((row) => (
                <li
                  key={row.key}
                  className={progressStyles.badge}
                  data-reached={row.reachedOn ? 'true' : 'false'}
                  data-achievement={row.key}
                >
                  <span className={progressStyles.badgeMark} aria-hidden="true">
                    <BotanicalIcon
                      name={row.reachedOn ? 'check' : 'goals'}
                      size={18}
                      weight={row.reachedOn ? 'bold' : 'regular'}
                    />
                  </span>
                  <span className={progressStyles.badgeBody}>
                    <span className={progressStyles.badgeTitle}>{row.title}</span>
                    <span className={progressStyles.badgeNote}>
                      {row.reachedOn
                        ? `Reached ${shortDate(row.reachedOn)}. ${row.description}`
                        : row.threshold > 1
                          ? `${row.description} ${row.progress} of ${row.threshold} so far.`
                          : row.description}
                    </span>
                    {!row.reachedOn && row.threshold > 1 ? (
                      <span className={progressStyles.badgeBar} aria-hidden="true">
                        <span
                          className={progressStyles.badgeBarFill}
                          style={{ width: `${Math.round((row.progress / row.threshold) * 100)}%` }}
                        />
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className={styles.cards}>
            <section className={`${styles.panel} kgSurface`} aria-labelledby="grove-month-title">
              <div className={styles.panelHead}>
                <h2 id="grove-month-title">{monthKey(today).replace(/ \d{4}$/, '')}</h2>
                <p className={styles.muted}>
                  {stepsThisMonth} {stepsThisMonth === 1 ? 'step' : 'steps'} on {planted}{' '}
                  {planted === 1 ? 'day' : 'days'}
                </p>
              </div>
              <div
                className={styles.groveGrid}
                role="img"
                aria-label={`${planted} of ${cells.length} days this month carry a confirmed step`}
              >
                {cells.map((cell) => (
                  <span
                    key={cell.iso}
                    className={`${styles.cell} ${
                      cell.planted ? styles.cellPlanted : cell.today ? styles.cellToday : ''
                    }`}
                  >
                    {cell.day}
                  </span>
                ))}
              </div>
            </section>

            <section className={`${styles.panel} kgSurface`} aria-labelledby="grove-records-title">
              <div className={styles.panelHead}>
                <h2 id="grove-records-title">Your records</h2>
              </div>
              <ul className={progressStyles.records}>
                {records.map((record) => (
                  <li key={record.label} className={progressStyles.record}>
                    <span className={progressStyles.recordLabel}>
                      {record.label}
                      <span className={progressStyles.recordWhen}>{record.when}</span>
                    </span>
                    <span className={`${progressStyles.recordValue} kgNum`}>{record.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={`${styles.panel} kgSurface`} aria-labelledby="grove-trail-title">
            <div className={styles.panelHead}>
              <h2 id="grove-trail-title">Your trail</h2>
              {events.length ? (
                <p className={styles.muted}>
                  {events.length} {events.length === 1 ? 'step' : 'steps'}
                </p>
              ) : null}
            </div>
            {events.length === 0 ? (
              <div className={styles.empty}>
                <h3>Your story starts with a step.</h3>
                <p>
                  Tasks you tick off, goal steps you confirm, workouts you finish and food
                  you log all land here, the day you do them. Nothing is added just for
                  opening the app.
                </p>
                <a href="/today" className="kgGhost">
                  Go to Home
                </a>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.month} className={progressStyles.trailMonth}>
                  <p className={`kgEyebrow ${progressStyles.trailMonthTitle}`}>{group.month}</p>
                  <ul className={styles.history}>
                    {group.rows.map((event) => {
                      const source =
                        data.tasks.find((task) => task.id === event.source_id)?.title ??
                        data.goals.find((goal) => goal.id === event.source_id)?.title ??
                        null;
                      const kind = eventLabel(event.event_type);
                      return (
                        <li key={event.id}>
                          <strong>{source ?? kind}</strong>
                          <p>
                            <span>{shortDate(event.logical_date)}</span>
                            {source ? (
                              <>
                                {' · '}
                                <span>{kind}</span>
                              </>
                            ) : null}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </section>
  );
}
