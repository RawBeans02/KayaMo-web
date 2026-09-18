'use client';
import {
  listLocalGoalMilestones,
  listLocalGoals,
  listLocalTasksForDate,
  type LocalGoalMilestone,
} from '@kayamo/offline';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeskClock } from '../desk/use-desk-clock';
import { GoalEditor } from './goal-editor';
import { BotanicalIcon } from './icons';
import { useRecords } from './use-records';
import styles from './botanical.module.css';
import { trapDialogTab } from './dialog-keyboard';
import { openDialog, closeDialog } from './dialog-motion';

function statusLabel(status: string) {
  if (status === 'released') return 'Released';
  if (status === 'completed') return 'Completed';
  if (status === 'paused') return 'Paused';
  return 'In progress';
}

export function BotanicalGoals({ userId }: { userId: string }) {
  const { clock, today } = useDeskClock(userId);
  const load = useCallback(async () => {
    const [goals, tasks] = await Promise.all([
      listLocalGoals(userId),
      listLocalTasksForDate(userId, today),
    ]);
    const lists = await Promise.all(
      goals.map((goal) => listLocalGoalMilestones(userId, goal.id)),
    );
    const milestones: Record<string, LocalGoalMilestone[]> = {};
    goals.forEach((goal, index) => {
      milestones[goal.id] = lists[index] ?? [];
    });
    return { goals, tasks, milestones };
  }, [userId, today]);
  const { data, error, refresh } = useRecords(load);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) openDialog(dialog.current);
    else dialog.current?.close();
  }, [open]);
  return (
    <section className={styles.page} aria-labelledby="goals-title">
      <header className={styles.header}>
        <div>
          <h1 id="goals-title" className="kgTitle">
            Goals
          </h1>
          <p className={styles.lede}>
            Make room for what matters. One today-sized step at a time.
          </p>
        </div>
        <button
          className="kgAccent"
          disabled={!data}
          onClick={(event) => {
            event.currentTarget.focus();
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
        <p role="status" className={styles.muted}>
          Loading your goals…
        </p>
      ) : data.goals.length === 0 ? (
        <section className={`${styles.panel} kgSurface`}>
          <div className={styles.empty}>
            <h3>What would you like to grow toward?</h3>
            <p>
              Choose something meaningful, describe a first step, and bring it into your
              day. You can pause or release a goal whenever you need.
            </p>
            <button
              className="kgGhost"
              onClick={(event) => {
                event.currentTarget.focus();
                setSelected(null);
                setOpen(true);
              }}
            >
              Create your first goal
            </button>
          </div>
        </section>
      ) : (
        <div className={styles.stack}>
          {data.goals.map((goal) => {
            const milestones = data.milestones[goal.id] ?? [];
            const done = milestones.filter((row) => row.completed_at).length;
            const nextIndex = milestones.findIndex((row) => !row.completed_at);
            const status = statusLabel(goal.status);
            return (
              <section
                key={goal.id}
                className={`${styles.goalCard} kgSurface`}
                aria-labelledby={'goal-' + goal.id}
              >
                <div className={styles.goalHead}>
                  <h2 id={'goal-' + goal.id}>{goal.title}</h2>
                  <span className={styles.goalProgress}>
                    {milestones.length ? done + ' of ' + milestones.length : status}
                  </span>
                </div>
                {milestones.length > 0 && (
                  <span className={styles.bar} aria-hidden="true">
                    <span
                      className={styles.barFill}
                      style={{ width: (done / milestones.length) * 100 + '%' }}
                    />
                  </span>
                )}
                {goal.description && <p className={styles.muted}>{goal.description}</p>}
                {milestones.length > 0 && (
                  <ul className={styles.milestones}>
                    {milestones.map((milestone, index) => (
                      <li
                        key={milestone.id}
                        className={`${styles.milestone} ${
                          milestone.completed_at ? styles.msDone : ''
                        }`}
                      >
                        <span
                          className={`${styles.dot} ${
                            milestone.completed_at ? styles.dotDone : ''
                          }`}
                          aria-hidden="true"
                        >
                          <BotanicalIcon name="check" size={14} weight="bold" />
                        </span>
                        <span className={styles.msTitle}>{milestone.title}</span>
                        {index === nextIndex && <span className="kgEyebrow">Next</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  className={`${styles.goalOpen} kgGhost`}
                  aria-label={'Open ' + goal.title}
                  onClick={(event) => {
                    event.currentTarget.focus();
                    setSelected(goal.id);
                    setOpen(true);
                  }}
                >
                  Open goal
                  <BotanicalIcon name="next" size={18} />
                </button>
              </section>
            );
          })}
        </div>
      )}
      <dialog
        ref={dialog}
        className={`${styles.dialog} ${styles.dialogFlush}`}
        aria-label="Goal editor"
        onKeyDown={trapDialogTab}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog(dialog.current, () => setOpen(false));
        }}
      >
        {open && data && (
          <GoalEditor
            userId={userId}
            logicalDate={today}
            {...clock}
            goals={data.goals}
            todayTasks={data.tasks}
            initialGoalId={selected}
            onClose={() => closeDialog(dialog.current, () => setOpen(false))}
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
