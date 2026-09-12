'use client';
import { listLocalGoals, listLocalTasksForDate } from '@kayamo/offline';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeskClock } from '../desk/use-desk-clock';
import { GoalFlow } from '../journey/goal-flow';
import { BotanicalIcon } from './icons';
import { useRecords } from './use-records';
import styles from './botanical.module.css';

export function BotanicalGoals({ userId }: { userId: string }) {
  const { clock, today } = useDeskClock(userId);
  const load = useCallback(async () => {
    const [goals, tasks] = await Promise.all([
      listLocalGoals(userId),
      listLocalTasksForDate(userId, today),
    ]);
    return { goals, tasks };
  }, [userId, today]);
  const { data, error, refresh } = useRecords(load);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <section className={styles.page} aria-labelledby="goals-title">
      <header className={styles.header}>
        <div>
          <h1 id="goals-title">Goals</h1>
          <p>Make room for what matters. One today-sized step at a time.</p>
        </div>
        <button
          className={styles.primary}
          disabled={!data}
          onClick={() => {
            setSelected(null);
            setOpen(true);
          }}
        >
          <BotanicalIcon name="plus" size={18} />
          New goal
        </button>
      </header>
      {error && (
        <div className={styles.notice} role="alert">
          {error}
          <button className={styles.secondary} onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}
      {!data ? (
        <p role="status">Loading your goals…</p>
      ) : data.goals.length === 0 ? (
        <section className={styles.panel}>
          <div className={styles.empty}>
            <h3>What would you like to grow toward?</h3>
            <p>
              Choose something meaningful, describe a first step, and bring it into your
              day. You can pause or release a goal whenever you need.
            </p>
            <button
              className={styles.primary}
              onClick={() => {
                setSelected(null);
                setOpen(true);
              }}
            >
              Create your first goal
            </button>
          </div>
        </section>
      ) : (
        <div className={styles.cards}>
          {data.goals.map((goal) => (
            <button
              key={goal.id}
              className={styles.panel}
              style={{ textAlign: 'left' }}
              onClick={() => {
                setSelected(goal.id);
                setOpen(true);
              }}
            >
              <p className={styles.muted}>
                {goal.status === 'released'
                  ? 'Released'
                  : goal.status === 'completed'
                    ? 'Completed'
                    : goal.status === 'paused'
                      ? 'Paused'
                      : 'In progress'}
              </p>
              <h2 style={{ marginTop: 8 }}>{goal.title}</h2>
              {goal.description && <p className={styles.muted}>{goal.description}</p>}
              <span className={styles.tool}>
                Open goal
                <BotanicalIcon name="next" />
              </span>
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        className={styles.dialog}
        data-botanical-goal-flow=""
        aria-label="Goal editor"
        onCancel={() => setOpen(false)}
      >
        {open && data && (
          <GoalFlow
            userId={userId}
            logicalDate={today}
            {...clock}
            goals={data.goals}
            todayTasks={data.tasks}
            initialGoalId={selected}
            persistDraft
            onClose={() => setOpen(false)}
            onChat={() => {
              window.location.href = '/mus';
            }}
            onGoToday={() => {
              window.location.href = '/today';
            }}
            onChanged={refresh}
          />
        )}
      </dialog>
    </section>
  );
}
