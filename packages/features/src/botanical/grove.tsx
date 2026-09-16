'use client';
import {
  getLocalCompanionProgression,
  listLocalCompanionEvents,
  listLocalTasks,
  listLocalGoals,
  listLocalLifeStory,
} from '@kayamo/offline';
import { useCallback } from 'react';
import { useDeskClock } from '../desk/use-desk-clock';
import { useRecords } from './use-records';
import styles from './botanical.module.css';

const day = (iso: string, offset: number) => {
  const cursor = new Date(iso + 'T12:00:00Z');
  cursor.setUTCDate(cursor.getUTCDate() + offset);
  return cursor.toISOString().slice(0, 10);
};

/**
 * Consecutive days ending today that carry a confirmed step. A day still in
 * progress does not break the run, which is why an empty today falls through
 * to yesterday rather than resetting the count.
 */
function currentStreak(dates: Set<string>, today: string) {
  let cursor = dates.has(today) ? today : day(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = day(cursor, -1);
  }
  return streak;
}

function monthCells(dates: Set<string>, today: string) {
  const month = today.slice(0, 7);
  // Slice rather than split/destructure: the logical date is always YYYY-MM-DD,
  // and this stays total under noUncheckedIndexedAccess.
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  // Day 0 of month `index` (1-based) is the last day of that month.
  const length = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return Array.from({ length }, (_, i) => {
    const iso = month + '-' + String(i + 1).padStart(2, '0');
    return { iso, planted: dates.has(iso), today: iso === today };
  });
}

export function BotanicalGrove({ userId }: { userId: string }) {
  const { today } = useDeskClock(userId);
  const load = useCallback(async () => {
    const [progress, events, tasks, goals, story] = await Promise.all([
      getLocalCompanionProgression(userId),
      listLocalCompanionEvents(userId),
      listLocalTasks(userId),
      listLocalGoals(userId),
      listLocalLifeStory(userId),
    ]);
    return { progress, events, tasks, goals, story };
  }, [userId]);
  const { data, error, refresh } = useRecords(load);
  const dates = new Set((data?.events ?? []).map((event) => event.logical_date));
  const streak = currentStreak(dates, today);
  const cells = monthCells(dates, today);
  const planted = cells.filter((cell) => cell.planted).length;
  const monthName = new Date(today + 'T12:00:00Z').toLocaleDateString('en-PH', {
    month: 'long',
    timeZone: 'UTC',
  });
  return (
    <section className={styles.page} aria-labelledby="grove-title">
      <header className={styles.header}>
        <div>
          <h1 id="grove-title" className="kgTitle">
            Grove
          </h1>
          <p className={styles.lede}>
            A record of the steps you have confirmed. Quiet days take nothing away.
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
          <section className={`${styles.streak} kgSurface kgSheen`} aria-label="Streak">
            <div className={styles.streakBody}>
              <p className="kgEyebrow">Streak</p>
              <span className={`${styles.streakNum} kgNum`}>
                {streak}
                <span className={styles.streakUnit}>
                  {streak === 1 ? 'day' : 'days'}
                </span>
              </span>
              <p className={styles.streakNote}>
                Every day you confirm a step plants one seed. Miss a day and the grove
                pauses. It never dies.
              </p>
            </div>
          </section>
          <section
            className={`${styles.panel} kgSurface`}
            aria-labelledby="grove-month-title"
          >
            <div className={styles.panelHead}>
              <h2 id="grove-month-title">{monthName}</h2>
              <p className={styles.muted}>
                {planted} of {cells.length} planted
              </p>
            </div>
            <div
              className={styles.groveGrid}
              role="img"
              aria-label={
                planted +
                ' of ' +
                cells.length +
                ' days in ' +
                monthName +
                ' carry a confirmed step'
              }
            >
              {cells.map((cell) => (
                <span
                  key={cell.iso}
                  className={`${styles.cell} ${
                    cell.planted
                      ? styles.cellPlanted
                      : cell.today
                        ? styles.cellToday
                        : ''
                  }`}
                />
              ))}
            </div>
          </section>
          <div className={styles.cards}>
            <section
              className={`${styles.panel} kgSurface`}
              aria-labelledby="grove-growth-title"
            >
              <h2 id="grove-growth-title">Your growth</h2>
              <span className={`${styles.stat} kgNum`}>
                {data.progress.totalPoints}
                <span className={styles.statUnit}>points</span>
              </span>
              <p className={styles.muted}>
                Stage: {data.progress.stageKey.replaceAll('_', ' ')}. Based only on
                confirmed records.
              </p>
            </section>
            <section
              className={`${styles.panel} kgSurface`}
              aria-labelledby="grove-days-title"
            >
              <h2 id="grove-days-title">Days with a confirmed step</h2>
              <span className={`${styles.stat} kgNum`}>{dates.size}</span>
              <p className={styles.muted}>A history, not a streak to maintain.</p>
            </section>
          </div>
          <section
            className={`${styles.panel} kgSurface`}
            aria-labelledby="grove-trail-title"
          >
            <div className={styles.panelHead}>
              <h2 id="grove-trail-title">Your trail</h2>
            </div>
            {data.events.length === 0 ? (
              <div className={styles.empty}>
                <h3>Your story starts with a step.</h3>
                <p>
                  Completed tasks, chosen milestones, and recorded progress will appear
                  here. Nothing is added just for opening the app.
                </p>
                <a href="/today" className="kgGhost">
                  Go to Home
                </a>
              </div>
            ) : (
              <ul className={styles.history}>
                {data.events
                  .slice()
                  .sort(
                    (a, b) =>
                      b.logical_date.localeCompare(a.logical_date) ||
                      b.created_at.localeCompare(a.created_at),
                  )
                  .map((event) => {
                    const source =
                      data.tasks.find((task) => task.id === event.source_id)?.title ??
                      data.goals.find((goal) => goal.id === event.source_id)?.title ??
                      null;
                    const kind = event.event_type.replaceAll('_', ' ');
                    // With no source to name, the kind IS the headline. Printing it
                    // again underneath said the same words twice.
                    return (
                      <li key={event.id}>
                        <strong>{source ?? kind}</strong>
                        <p>
                          <span>{event.logical_date}</span>
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
            )}
          </section>
          <section
            className={`${styles.panel} kgSurface`}
            aria-labelledby="grove-story-title"
          >
            <div className={styles.panelHead}>
              <h2 id="grove-story-title">Life story</h2>
            </div>
            {data.story.length ? (
              <ul className={styles.history}>
                {data.story.map((row) => (
                  <li key={row.id}>
                    <strong>{row.title}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>
                No saved story entries yet. Your confirmed activity remains in the trail
                above.
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
