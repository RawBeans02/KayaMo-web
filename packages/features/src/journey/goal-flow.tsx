'use client';

import {
  COMPANION_EVENT_POINTS,
  LIFE_AREA_LABELS,
  LIFE_AREAS,
  deadlineRisk,
  goalPlausibility,
  suggestLifeArea,
  type LifeArea,
} from '@kayamo/core';
import {
  createLocalGoalPlan,
  completeLocalGoalMilestone,
  createLocalGoalMilestone,
  createLocalTask,
  listLocalGoalMilestones,
  setLocalGoalStatus,
  updateLocalGoalMilestone,
  type LocalGoal,
  type LocalGoalMilestone,
  type LocalTask,
} from '@kayamo/offline';
import {
  ArrowLeft,
  Barbell,
  BookOpenText,
  Briefcase,
  CaretRight,
  ChatCircleDots,
  CheckCircle,
  Church,
  Coins,
  Compass,
  DotsThree,
  HandPalm,
  Info,
  Pause,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMinuteClock } from '../clock/use-clock';
import styles from '../screens/kayamo-app.module.css';

const EXAMPLES = [
  { label: 'Find work that does not drain me', Icon: Briefcase },
  { label: 'Earn ten thousand a month on the side', Icon: Coins },
  { label: 'Be at church on Sunday again', Icon: Church },
  { label: 'Finish the thesis chapter', Icon: BookOpenText },
  { label: 'Squat a hundred kilos', Icon: Barbell },
] as const;

type Step = 'empty' | 'draft' | 'active';

function weeksGoing(createdAt: string, nowMs: number): number {
  return Math.max(
    1,
    Math.floor(Math.max(0, nowMs - Date.parse(createdAt)) / 604_800_000) + 1,
  );
}

function thisWeekCount(milestones: LocalGoalMilestone[], nowMs: number): number {
  const start = nowMs - 7 * 86_400_000;
  return milestones.filter(
    (row) => row.completed_at && Date.parse(row.completed_at) >= start,
  ).length;
}

function trailWhen(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
}

export function GoalFlow({
  userId,
  logicalDate,
  timeZone,
  dayStartsAt,
  goals,
  todayTasks,
  initialGoalId,
  initialLifeArea = null,
  onClose,
  onChat,
  onGoToday,
  onChanged,
  onAddToStory,
  storySourceIds = [],
  persistDraft = false,
}: {
  userId: string;
  logicalDate: string;
  timeZone: string;
  dayStartsAt: string;
  goals: LocalGoal[];
  todayTasks: LocalTask[];
  initialGoalId: string | null;
  initialLifeArea?: LifeArea | null;
  onClose: () => void;
  onChat: () => void;
  onGoToday: () => void;
  onChanged: () => Promise<void>;
  onAddToStory?: (
    goal: LocalGoal,
    status: 'completed' | 'released',
  ) => Promise<void> | void;
  storySourceIds?: string[];
  persistDraft?: boolean;
}) {
  const nowMs = useMinuteClock();
  const [step, setStep] = useState<Step>(initialGoalId ? 'active' : 'empty');
  const [viewId, setViewId] = useState<string | null>(initialGoalId);
  const [created, setCreated] = useState<LocalGoal | null>(null);
  const [title, setTitle] = useState('');
  const [confirmationId, setConfirmationId] = useState<string>(() => crypto.randomUUID());
  const [why, setWhy] = useState('');
  const [doneLooks, setDoneLooks] = useState('');
  const [firstStep, setFirstStep] = useState('');
  const [lifeArea, setLifeArea] = useState<LifeArea | null>(initialLifeArea);
  const [doneBy, setDoneBy] = useState('');
  const [milestones, setMilestones] = useState<LocalGoalMilestone[]>([]);
  const [setdownOpen, setSetdownOpen] = useState(false);
  const [changingNext, setChangingNext] = useState(false);
  const [nextDraft, setNextDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const goal =
    (created && created.id === viewId ? created : null) ??
    goals.find((row) => row.id === viewId) ??
    null;

  const loadMilestones = useCallback(
    async (goalId: string) => {
      setMilestones(await listLocalGoalMilestones(userId, goalId));
    },
    [userId],
  );

  useEffect(() => {
    if (!viewId) return;
    let cancelled = false;
    void listLocalGoalMilestones(userId, viewId)
      .then((rows) => {
        if (!cancelled) setMilestones(rows);
      })
      .catch(() => {
        if (!cancelled)
          setNotice('Could not read the goal steps. Close and reopen to retry.');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, viewId]);

  const [draftReady, setDraftReady] = useState(!persistDraft);
  useEffect(() => {
    if (!persistDraft) return;
    try {
      const raw = sessionStorage.getItem('kayamo:goal-draft:' + userId);
      const saved: unknown = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === 'object' && !initialGoalId) {
        const value = saved as Record<string, unknown>;
        if (
          typeof value.confirmationId === 'string' &&
          /^[0-9a-f-]{36}$/i.test(value.confirmationId)
        )
          setConfirmationId(value.confirmationId);
        if (typeof value.title === 'string') setTitle(value.title);
        if (typeof value.why === 'string') setWhy(value.why);
        if (typeof value.doneLooks === 'string') setDoneLooks(value.doneLooks);
        if (typeof value.firstStep === 'string') setFirstStep(value.firstStep);
        if (typeof value.doneBy === 'string') setDoneBy(value.doneBy);
        if (
          typeof value.lifeArea === 'string' &&
          LIFE_AREAS.includes(value.lifeArea as LifeArea)
        ) {
          setLifeArea(value.lifeArea as LifeArea);
        }
        setStep('draft');
      }
    } catch {
      /* A damaged browser draft never changes saved goals. */
    }
    setDraftReady(true);
  }, [persistDraft, userId, initialGoalId]);
  useEffect(() => {
    if (!persistDraft || !draftReady || step !== 'draft') return;
    try {
      sessionStorage.setItem(
        'kayamo:goal-draft:' + userId,
        JSON.stringify({
          title,
          why,
          doneLooks,
          firstStep,
          doneBy,
          lifeArea,
          confirmationId,
        }),
      );
    } catch {
      /* Saving the goal still uses IndexedDB. */
    }
  }, [
    persistDraft,
    draftReady,
    step,
    userId,
    title,
    why,
    doneLooks,
    firstStep,
    doneBy,
    lifeArea,
    confirmationId,
  ]);

  const completed = milestones.filter((row) => row.completed_at);
  const next = milestones.find((row) => !row.completed_at) ?? null;
  const onToday = Boolean(
    next &&
    todayTasks.some(
      (task) =>
        !task.completed_at &&
        task.title.trim().toLowerCase() === next.title.trim().toLowerCase(),
    ),
  );
  const weeks = goal ? weeksGoing(goal.created_at, nowMs) : 1;
  const weekHits = thisWeekCount(milestones, nowMs);
  const remainingSteps = milestones.filter((row) => !row.completed_at).length;
  const risk = deadlineRisk({
    today: logicalDate,
    targetDate: goal?.target_date,
    remainingSteps,
  });
  const pace = goalPlausibility({ remainingSteps, daysLeft: risk.daysLeft });
  const nextTitle = changingNext ? nextDraft : (next?.title ?? nextDraft);

  const stats = useMemo(
    () => [
      {
        value: String(completed.length),
        label: completed.length === 1 ? 'step confirmed' : 'steps confirmed',
      },
      { value: String(weeks), label: weeks === 1 ? 'week going' : 'weeks going' },
      { value: String(weekHits), label: 'this week' },
    ],
    [completed.length, weekHits, weeks],
  );

  function openDraft(seed = '') {
    setConfirmationId(crypto.randomUUID());
    setTitle(seed);
    setWhy('');
    setDoneLooks('');
    setFirstStep('');
    setLifeArea(initialLifeArea ?? suggestLifeArea(seed));
    setDoneBy('');
    setStep('draft');
  }

  async function confirmGoal() {
    const heading = title.trim();
    if (!heading || busy) return;
    setBusy(true);
    try {
      const stepTitle = firstStep.trim();
      const row = await createLocalGoalPlan({
        id: confirmationId,
        userId,
        title: heading,
        description: why.trim() || null,
        lifeArea,
        targetDate: doneBy || null,
        firstStep: stepTitle,
        doneLooks,
        logicalDate,
      });
      if (persistDraft) {
        try {
          sessionStorage.removeItem('kayamo:goal-draft:' + userId);
        } catch {
          /* Optional browser draft. */
        }
      }
      setViewId(row.id);
      setCreated(row);
      setStep('active');
      setNotice(
        stepTitle
          ? 'Goal saved. The first step is on Home.'
          : 'Goal saved after your confirmation.',
      );
      await onChanged();
      await loadMilestones(row.id);
    } catch {
      setNotice('Could not finish saving. Your input is still here. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function putNextOnToday() {
    const label = nextTitle.trim();
    if (!goal || !label || busy) return;
    setBusy(true);
    try {
      if (next && label !== next.title) {
        await updateLocalGoalMilestone({ id: next.id, userId, title: label });
      } else if (!next) {
        await createLocalGoalMilestone({
          userId,
          goalId: goal.id,
          title: label,
          sortOrder: milestones.length,
        });
      }
      const already = todayTasks.some(
        (task) =>
          !task.completed_at && task.title.trim().toLowerCase() === label.toLowerCase(),
      );
      if (!already) {
        await createLocalTask({ userId, title: label, scheduledFor: logicalDate });
      }
      setChangingNext(false);
      setNotice(
        'Added to Home. Complete the daily task there, and confirm the goal step here when it is reached.',
      );
      await onChanged();
      await loadMilestones(goal.id);
    } catch {
      setNotice('Could not finish saving. Your input is still here. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: 'active' | 'paused' | 'completed' | 'released') {
    if (!goal || busy) return;
    setBusy(true);
    try {
      const row = await setLocalGoalStatus({
        id: goal.id,
        userId,
        status,
        timeZone,
        dayStartsAt,
      });
      if (row) setCreated(row);
      setSetdownOpen(false);
      if (status === 'paused') {
        setNotice('Goal paused. Existing daily tasks remain yours to keep or edit.');
      } else if (status === 'completed') {
        setNotice(
          `Reached. +${COMPANION_EVENT_POINTS.goal_completed} toward the next stage.`,
        );
      } else if (status === 'released') {
        setNotice('Set down. The trail stays. Nothing was taken away.');
      } else {
        setNotice('Goal resumed. Add the next step to Home when you are ready.');
      }
      await onChanged();
    } catch {
      setNotice('Could not finish saving. Your input is still here. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'empty') {
    return (
      <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
        <div className={styles.flowWash} aria-hidden="true" />
        <div className={styles.flowTop}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Back to Goals"
            onClick={onClose}
          >
            <ArrowLeft size={21} />
          </button>
        </div>
        <div className={styles.flowScroll}>
          <p className={styles.flowKicker}>Goals</p>
          <h1 className={styles.flowTitle}>What are you working toward?</h1>
          <p className={styles.flowLead}>
            One thing at a time, big enough to matter. It does not have to be about food
            or the gym.
          </p>
          <div className={styles.goalExamples}>
            {EXAMPLES.map((row) => (
              <button key={row.label} type="button" onClick={() => openDraft(row.label)}>
                <row.Icon size={20} />
                <span>{row.label}</span>
                <CaretRight size={16} />
              </button>
            ))}
          </div>
          <p className={styles.flowNote}>
            These are examples, not a menu. Lis can work with anything you can say out
            loud.
          </p>
        </div>
        <div className={styles.flowFooter}>
          <button className={styles.primaryButton} type="button" onClick={onChat}>
            <ChatCircleDots size={20} /> Talk it through with Lis
          </button>
          <button className={styles.ghostWide} type="button" onClick={() => openDraft()}>
            Write it myself
          </button>
        </div>
      </div>
    );
  }

  if (step === 'draft') {
    return (
      <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
        <div className={styles.activeHeader}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Back"
            onClick={() => setStep('empty')}
          >
            <ArrowLeft size={21} />
          </button>
          <h1>Your goal, in your words</h1>
        </div>
        <div className={styles.flowScroll}>
          <p className={styles.flowLead}>
            Every line is yours to change, and nothing is saved until you confirm.
          </p>
          {notice ? (
            <p role="status" className={styles.flowLead}>
              {notice}
            </p>
          ) : null}
          <div className={styles.goalDraft}>
            <label>
              <span>The goal</span>
              <textarea
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                rows={2}
              />
            </label>
            <label>
              <span>Why it matters</span>
              <textarea
                value={why}
                onChange={(event) => setWhy(event.target.value)}
                rows={2}
              />
            </label>
            <label>
              <span>What done looks like</span>
              <textarea
                value={doneLooks}
                onChange={(event) => setDoneLooks(event.target.value)}
                rows={2}
              />
            </label>
            <label>
              <span>First step, today-sized</span>
              <textarea
                value={firstStep}
                onChange={(event) => setFirstStep(event.target.value)}
                rows={2}
              />
            </label>
            <label>
              <span>Done-by date · optional</span>
              <input
                type="date"
                value={doneBy}
                onChange={(event) => setDoneBy(event.target.value)}
              />
            </label>
          </div>
          <p className={styles.eyebrow}>Life area · optional</p>
          <div className={styles.choiceRow}>
            {LIFE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                className={lifeArea === area ? styles.choiceOn : styles.choiceOff}
                aria-pressed={lifeArea === area}
                onClick={() => setLifeArea((current) => (current === area ? null : area))}
              >
                {LIFE_AREA_LABELS[area]}
              </button>
            ))}
          </div>
          <div className={styles.goalHint}>
            <Info size={19} />
            <p>
              Steps land on Home as ordinary tasks. Confirming one is what moves the goal
              Lis never marks it for you.
            </p>
          </div>
        </div>
        <div className={styles.flowFooter}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={!title.trim() || busy}
            onClick={() => void confirmGoal()}
          >
            Make this my goal
          </button>
          <button className={styles.ghostWide} type="button" onClick={onChat}>
            Keep talking about it
          </button>
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
        <div className={styles.activeHeader}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Back to Goals"
            onClick={onClose}
          >
            <ArrowLeft size={21} />
          </button>
          <h1>Goal</h1>
        </div>
        <p className={styles.flowLead}>This goal is no longer on the device.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
      <div className={styles.flowWash} aria-hidden="true" />
      <div className={styles.flowTop}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Back to Goals"
          onClick={onClose}
        >
          <ArrowLeft size={21} />
        </button>
        <span className={styles.eyebrow}>
          {goal.status === 'active' ? 'working toward' : goal.status}
        </span>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.goalMenu}`}
          aria-label="Pause or set it down"
          onClick={() => setSetdownOpen(true)}
        >
          <DotsThree size={22} />
        </button>
      </div>
      <div className={styles.flowScroll}>
        <h1 className={styles.flowTitle}>{goal.title}</h1>
        {goal.description ? <p className={styles.flowLead}>{goal.description}</p> : null}

        <div className={styles.goalStats}>
          {stats.map((row) => (
            <div key={row.label}>
              <p>{row.value}</p>
              <span>{row.label}</span>
            </div>
          ))}
        </div>

        {goal.target_date ? (
          <div className={styles.surfaceCard}>
            <p>{risk.reason || `A date is set: ${goal.target_date}.`}</p>
            <p className={styles.muted}>{pace.reason}</p>
          </div>
        ) : null}

        <div className={styles.goalNext}>
          <p className={styles.eyebrow}>Next step</p>
          {changingNext ? (
            <textarea
              value={nextDraft}
              onChange={(event) => setNextDraft(event.target.value)}
              rows={2}
              autoFocus
            />
          ) : (
            <p className={styles.goalNextTitle}>
              {next?.title ?? 'Add a today-sized step when you are ready.'}
            </p>
          )}
          <p className={styles.muted}>
            {onToday
              ? 'Already on Home. Confirming it there is what moves this.'
              : 'Lis will not mark this for you. Put it on Home, then confirm it there.'}
          </p>
          {persistDraft && next && (
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await completeLocalGoalMilestone({
                    id: next.id,
                    userId,
                    timeZone,
                    dayStartsAt,
                  });
                  await loadMilestones(goal.id);
                  await onChanged();
                  setNotice('Step confirmed.');
                } catch {
                  setNotice('Could not confirm this step. Please retry.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm step complete
            </button>
          )}
          <div className={styles.buttonRow}>
            {onToday ? (
              <button className={styles.primaryButton} type="button" onClick={onGoToday}>
                Open Home
              </button>
            ) : (
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!nextTitle.trim() || busy}
                onClick={() => void putNextOnToday()}
              >
                Put it on today
              </button>
            )}
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                setNextDraft(next?.title ?? '');
                setChangingNext((open) => !open);
              }}
            >
              Change
            </button>
          </div>
        </div>

        <p className={styles.eyebrow} style={{ margin: '20px 22px 8px' }}>
          What you have confirmed
        </p>
        <div className={styles.goalTrail}>
          {completed.length === 0 ? (
            <p>Nothing confirmed yet. Quiet weeks take nothing away.</p>
          ) : (
            completed
              .slice()
              .reverse()
              .map((row) => (
                <div key={row.id}>
                  <CheckCircle size={19} weight="fill" />
                  <span>
                    <strong>{row.title}</strong>
                    <small>
                      {row.completed_at ? trailWhen(row.completed_at, timeZone) : ''}
                    </small>
                  </span>
                  <b>+{COMPANION_EVENT_POINTS.milestone_completed}</b>
                </div>
              ))
          )}
          {completed.length > 0 ? (
            <p>Nothing here can be undone by a quiet week.</p>
          ) : null}
        </div>

        <div className={styles.goalLinks}>
          <button type="button" onClick={onChat}>
            <ChatCircleDots size={19} />
            <span>Check in with Lis</span>
            <CaretRight size={15} />
          </button>
          <button type="button" onClick={() => setSetdownOpen(true)}>
            <HandPalm size={19} />
            <span>Pause or set it down</span>
            <CaretRight size={15} />
          </button>
          {goal.status === 'paused' || goal.status === 'released' ? (
            <button type="button" onClick={() => void setStatus('active')}>
              <Compass size={19} />
              <span>Pick this back up</span>
              <CaretRight size={15} />
            </button>
          ) : null}
          {onAddToStory &&
          (goal.status === 'completed' || goal.status === 'released') &&
          !storySourceIds.includes(goal.id) ? (
            <button
              type="button"
              onClick={() =>
                void onAddToStory(
                  goal,
                  goal.status === 'released' ? 'released' : 'completed',
                )
              }
            >
              <BookOpenText size={19} />
              <span>Keep in Life Story</span>
              <CaretRight size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {setdownOpen ? (
        <div className={styles.sheetScrim}>
          <button
            type="button"
            className={styles.sheetBackdrop}
            aria-label="Close"
            data-kayamo-back-dismiss="true"
            onClick={() => setSetdownOpen(false)}
          />
          <div
            className={styles.bottomSheet}
            role="dialog"
            aria-label="Pause or set down this goal"
          >
            <div className={styles.sheetHandle} aria-hidden="true" />
            <p>This does not have to be a failure.</p>
            <small>
              Confirmed steps stay in Goals either way. Nothing is deducted, and you can
              pick this up any week.
            </small>
            <div className={styles.goalSetdown}>
              <button type="button" onClick={() => void setStatus('paused')}>
                <Pause size={20} />
                <span>
                  <strong>Pause it</strong>
                  <small>Off Home, still in Goals. No check-ins.</small>
                </span>
              </button>
              <button type="button" onClick={() => void setStatus('released')}>
                <HandPalm size={20} />
                <span>
                  <strong>Set it down</strong>
                  <small>Closed, with the trail kept. Not marked as failed.</small>
                </span>
              </button>
              <button type="button" onClick={() => void setStatus('completed')}>
                <CheckCircle size={20} weight="fill" />
                <span>
                  <strong>It actually happened</strong>
                  <small>
                    {doneLooks.trim() || next?.title || 'Close it as reached.'}
                  </small>
                </span>
              </button>
            </div>
            <button
              className={styles.textLink}
              type="button"
              onClick={() => setSetdownOpen(false)}
            >
              Keep going for now
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className={styles.toast} role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
