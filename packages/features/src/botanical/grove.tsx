'use client';
import {
  getLocalCompanionProgression,
  listLocalCompanionEvents,
  listLocalTasks,
  listLocalGoals,
  listLocalLifeStory,
} from '@kayamo/offline';
import { useCallback } from 'react';
import { useRecords } from './use-records';
import styles from './botanical.module.css';

export function BotanicalGrove({ userId }: { userId: string }) {
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
  return (
    <section className={styles.page} aria-labelledby="grove-title">
      <header className={styles.header}>
        <div>
          <h1 id="grove-title">Grove</h1>
          <p>A record of the steps you have confirmed. Quiet days take nothing away.</p>
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
        <p role="status">Loading your history…</p>
      ) : (
        <>
          <div className={styles.cards}>
            <section className={styles.panel}>
              <h2>Your growth</h2>
              <p className={styles.stat}>
                {data.progress.totalPoints} <span className={styles.muted}>points</span>
              </p>
              <p className={styles.muted}>
                Stage: {data.progress.stageKey.replaceAll('_', ' ')}. Based only on
                confirmed records.
              </p>
            </section>
            <section className={styles.panel}>
              <h2>Days with a confirmed step</h2>
              <p className={styles.stat}>
                {new Set(data.events.map((event) => event.logical_date)).size}
              </p>
              <p className={styles.muted}>A history, not a streak to maintain.</p>
            </section>
          </div>
          <section className={styles.panel} style={{ marginTop: 20 }}>
            <h2>Your trail</h2>
            {data.events.length === 0 ? (
              <div className={styles.empty}>
                <h3>Your story starts with a step.</h3>
                <p>
                  Completed tasks, chosen milestones, and recorded progress will appear
                  here. Nothing is added just for opening the app.
                </p>
                <a href="/today" className={styles.secondary}>
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
                  .map((event) => (
                    <li key={event.id}>
                      <strong>
                        {data.tasks.find((task) => task.id === event.source_id)?.title ??
                          data.goals.find((goal) => goal.id === event.source_id)?.title ??
                          event.event_type.replaceAll('_', ' ')}
                      </strong>
                      <p className={styles.muted}>
                        {event.logical_date} · {event.event_type.replaceAll('_', ' ')}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </section>
          <section className={styles.panel} style={{ marginTop: 20 }}>
            <h2>Life story</h2>
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
        </>
      )}
    </section>
  );
}
