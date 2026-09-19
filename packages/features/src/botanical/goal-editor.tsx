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
  completeLocalGoalMilestone,
  createLocalGoalMilestone,
  createLocalGoalPlan,
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMinuteClock } from '../clock/use-clock';
import styles from './goal-editor.module.css';

/**
 * The goal editor, on glass. Mounted by BotanicalGoals inside its dialog.
 *
 * Three views: an empty prompt with examples, the draft form, and the active
 * goal with its next step and trail. The words are the product: Lis proposes,
 * the person confirms, nothing is saved until they say so, and setting a goal
 * down is never called a failure. A browser draft survives a reload and a
 * failed save keeps the input on screen.
 *
 * Replaces journey/goal-flow.tsx (the phone flow rendering the 4,817-line
 * phone stylesheet inside this dialog) on 2026-09-19. Every label, button and
 * status string the e2e specs pin is kept verbatim.
 */

const EXAMPLES = [
  { label: 'Find work that does not drain me', Icon: Briefcase },
  { label: 'Earn ten thousand a month on the side', Icon: Coins },
  { label: 'Be at church on Sunday again', Icon: Church },
  { label: 'Finish the thesis chapter', Icon: BookOpenText },
  { label: 'Squat a hundred kilos', Icon: Barbell },
] as const;

const SAVE_FAILED = 'Could not finish saving. Your input is still here. Please retry.';

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

function draftKey(userId: string): string {
  return 'kayamo:goal-draft:' + userId;
}

function forgetDraft(userId: string) {
  try {
    sessionStorage.removeItem(draftKey(userId));
  } catch {
    /* Optional browser draft. */
  }
}

export function GoalEditor({
  userId,
  logicalDate,
  timeZone,
  dayStartsAt,
  goals,
  todayTasks,
  initialGoalId,
  onClose,
  onChat,
  onGoToday,
  onChanged,
}: {
  userId: string;
  logicalDate: string;
  timeZone: string;
  dayStartsAt: string;
  goals: LocalGoal[];
  todayTasks: LocalTask[];
  initialGoalId: string | null;
  onClose: () => void;
  onChat: () => void;
  onGoToday: () => void;
  onChanged: () => Promise<void>;
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
  const [lifeArea, setLifeArea] = useState<LifeArea | null>(null);
  const [doneBy, setDoneBy] = useState('');
  const [milestones, setMilestones] = useState<LocalGoalMilestone[]>([]);
  const [setdownOpen, setSetdownOpen] = useState(false);
  const [changingNext, setChangingNext] = useState(false);
  const [nextDraft, setNextDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const setdownRef = useRef<HTMLElement>(null);

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

  /* A draft in progress survives a reload. Read once on mount, written on every
     change while the form is open, forgotten on save. */
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey(userId));
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
  }, [userId, initialGoalId]);
  useEffect(() => {
    if (!draftReady || step !== 'draft') return;
    try {
      sessionStorage.setItem(
        draftKey(userId),
        JSON.stringify({ title, why, doneLooks, firstStep, doneBy, lifeArea, confirmationId }),
      );
    } catch {
      /* Saving the goal still uses IndexedDB. */
    }
  }, [draftReady, step, userId, title, why, doneLooks, firstStep, doneBy, lifeArea, confirmationId]);

  useEffect(() => {
    if (setdownOpen) setdownRef.current?.querySelector('button')?.focus();
  }, [setdownOpen]);

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

  const stats = [
    {
      value: String(completed.length),
      label: completed.length === 1 ? 'step confirmed' : 'steps confirmed',
    },
    { value: String(weeks), label: weeks === 1 ? 'week going' : 'weeks going' },
    { value: String(weekHits), label: 'this week' },
  ];

  function openDraft(seed = '') {
    setConfirmationId(crypto.randomUUID());
    setTitle(seed);
    setWhy('');
    setDoneLooks('');
    setFirstStep('');
    setLifeArea(suggestLifeArea(seed));
    setDoneBy('');
    setNotice(null);
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
      forgetDraft(userId);
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
      setNotice(SAVE_FAILED);
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
      setNotice(SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function confirmStep() {
    if (!goal || !next || busy) return;
    setBusy(true);
    try {
      await completeLocalGoalMilestone({ id: next.id, userId, timeZone, dayStartsAt });
      await loadMilestones(goal.id);
      await onChanged();
      setNotice('Step confirmed.');
    } catch {
      setNotice('Could not confirm this step. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: 'active' | 'paused' | 'completed' | 'released') {
    if (!goal || busy) return;
    setBusy(true);
    try {
      const row = await setLocalGoalStatus({ id: goal.id, userId, status, timeZone, dayStartsAt });
      if (row) setCreated(row);
      setSetdownOpen(false);
      if (status === 'paused') {
        setNotice('Goal paused. Existing daily tasks remain yours to keep or edit.');
      } else if (status === 'completed') {
        setNotice(`Reached. +${COMPANION_EVENT_POINTS.goal_completed} toward the next stage.`);
      } else if (status === 'released') {
        setNotice('Set down. The trail stays. Nothing was taken away.');
      } else {
        setNotice('Goal resumed. Add the next step to Home when you are ready.');
      }
      await onChanged();
    } catch {
      setNotice(SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  const back = (label: string, onClick: () => void) => (
    <button type="button" className={styles.iconButton} aria-label={label} onClick={onClick}>
      <ArrowLeft size={21} aria-hidden="true" />
    </button>
  );

  if (step === 'empty') {
    return (
      <div className={styles.root}>
        <div className={styles.top}>
          {back('Back to Goals', onClose)}
          <p className={`kgEyebrow ${styles.kicker}`}>Goals</p>
        </div>
        <div className={styles.scroll} data-goal-editor="scroll">
          <h2 className={styles.title}>What are you working toward?</h2>
          <p className={styles.lead}>
            One thing at a time, big enough to matter. It does not have to be about food
            or the gym.
          </p>
          <ul className={styles.examples}>
            {EXAMPLES.map((row) => (
              <li key={row.label}>
                <button type="button" className={styles.example} onClick={() => openDraft(row.label)}>
                  <row.Icon size={20} aria-hidden="true" />
                  <span>{row.label}</span>
                  <CaretRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className={`${styles.muted} ${styles.eyebrow}`}>
            These are examples, not a menu. Lis can work with anything you can say out
            loud.
          </p>
        </div>
        <div className={styles.footer} data-goal-editor="footer">
          <button className="kgAccent" type="button" onClick={onChat}>
            <ChatCircleDots size={20} aria-hidden="true" /> Talk it through with Lis
          </button>
          <button className="kgGhost" type="button" onClick={() => openDraft()}>
            Write it myself
          </button>
        </div>
      </div>
    );
  }

  if (step === 'draft') {
    return (
      <div className={styles.root}>
        <div className={styles.top}>
          {back('Back', () => setStep('empty'))}
          <p className={`kgEyebrow ${styles.kicker}`}>New goal</p>
        </div>
        <div className={styles.scroll} data-goal-editor="scroll">
          <h2 className={styles.title}>Your goal, in your words</h2>
          <p className={styles.lead}>
            Every line is yours to change, and nothing is saved until you confirm.
          </p>
          {notice ? (
            <p role="status" className={styles.status}>
              {notice}
            </p>
          ) : null}
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>The goal</span>
              <textarea value={title} onChange={(event) => setTitle(event.target.value)} rows={2} />
            </label>
            <label className={styles.field}>
              <span>Why it matters</span>
              <textarea value={why} onChange={(event) => setWhy(event.target.value)} rows={2} />
            </label>
            <label className={styles.field}>
              <span>What done looks like</span>
              <textarea
                value={doneLooks}
                onChange={(event) => setDoneLooks(event.target.value)}
                rows={2}
              />
            </label>
            <label className={styles.field}>
              <span>First step, today-sized</span>
              <textarea
                value={firstStep}
                onChange={(event) => setFirstStep(event.target.value)}
                rows={2}
              />
            </label>
            <label className={styles.field}>
              <span>Done-by date · optional</span>
              <input type="date" value={doneBy} onChange={(event) => setDoneBy(event.target.value)} />
            </label>
          </div>
          <p className={`kgEyebrow ${styles.eyebrow}`}>Life area · optional</p>
          <div className={styles.chips}>
            {LIFE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                className={styles.chip}
                aria-pressed={lifeArea === area}
                onClick={() => setLifeArea((current) => (current === area ? null : area))}
              >
                {LIFE_AREA_LABELS[area]}
              </button>
            ))}
          </div>
          <div className={styles.hint}>
            <Info size={19} aria-hidden="true" />
            <p>
              Steps land on Home as ordinary tasks. Confirming one is what moves the goal.
              Lis never marks it for you.
            </p>
          </div>
        </div>
        <div className={styles.footer} data-goal-editor="footer">
          <button
            className="kgAccent"
            type="button"
            disabled={!title.trim() || busy}
            onClick={() => void confirmGoal()}
          >
            Make this my goal
          </button>
          <button className="kgGhost" type="button" onClick={onChat}>
            Keep talking about it
          </button>
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className={styles.root}>
        <div className={styles.top}>
          {back('Back to Goals', onClose)}
          <p className={`kgEyebrow ${styles.kicker}`}>Goal</p>
        </div>
        <div className={styles.scroll} data-goal-editor="scroll">
          <p className={styles.lead}>This goal is no longer on the device.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        {back('Back to Goals', onClose)}
        <p className={`kgEyebrow ${styles.kicker}`}>
          {goal.status === 'active' ? 'Working toward' : goal.status}
        </p>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Pause or set it down"
          onClick={() => setSetdownOpen(true)}
        >
          <DotsThree size={22} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.scroll} data-goal-editor="scroll">
        <h2 className={styles.title}>{goal.title}</h2>
        {goal.description ? <p className={styles.lead}>{goal.description}</p> : null}
        {notice ? (
          <p role="status" className={styles.status}>
            {notice}
          </p>
        ) : null}

        <div className={styles.stats}>
          {stats.map((row) => (
            <div key={row.label} className={styles.stat}>
              <span className={`${styles.statNum} kgNum`}>{row.value}</span>
              <span className={styles.statLabel}>{row.label}</span>
            </div>
          ))}
        </div>

        {goal.target_date ? (
          <div className={styles.card}>
            <p>{risk.reason || `A date is set: ${goal.target_date}.`}</p>
            <p className={styles.muted}>{pace.reason}</p>
          </div>
        ) : null}

        <section className={styles.next} aria-labelledby="goal-next-title">
          <p id="goal-next-title" className={`kgEyebrow ${styles.eyebrow}`}>
            Next step
          </p>
          {changingNext ? (
            <textarea
              aria-label="Next step"
              value={nextDraft}
              onChange={(event) => setNextDraft(event.target.value)}
              rows={2}
              autoFocus
            />
          ) : (
            <p className={styles.nextTitle}>
              {next?.title ?? 'Add a today-sized step when you are ready.'}
            </p>
          )}
          <p className={styles.muted}>
            {onToday
              ? 'Already on Home. Confirming it there is what moves this.'
              : 'Lis will not mark this for you. Put it on Home, then confirm it there.'}
          </p>
          {next ? (
            <button
              type="button"
              className="kgGhost"
              disabled={busy}
              onClick={() => void confirmStep()}
            >
              <CheckCircle size={18} aria-hidden="true" />
              Confirm step complete
            </button>
          ) : null}
          <div className={styles.buttonRow}>
            {onToday ? (
              <button className="kgAccent" type="button" onClick={onGoToday}>
                Open Home
              </button>
            ) : (
              <button
                className="kgAccent"
                type="button"
                disabled={!nextTitle.trim() || busy}
                onClick={() => void putNextOnToday()}
              >
                Put it on today
              </button>
            )}
            <button
              className="kgGhost"
              type="button"
              onClick={() => {
                setNextDraft(next?.title ?? '');
                setChangingNext((open) => !open);
              }}
            >
              Change
            </button>
          </div>
        </section>

        <p className={`kgEyebrow ${styles.eyebrow}`}>What you have confirmed</p>
        {completed.length === 0 ? (
          <p className={styles.muted}>Nothing confirmed yet. Quiet weeks take nothing away.</p>
        ) : (
          <ul className={styles.trail}>
            {completed
              .slice()
              .reverse()
              .map((row) => (
                <li key={row.id} className={styles.trailRow}>
                  <CheckCircle size={19} weight="fill" aria-hidden="true" />
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.completed_at ? trailWhen(row.completed_at, timeZone) : ''}</small>
                  </span>
                  <b>+{COMPANION_EVENT_POINTS.milestone_completed}</b>
                </li>
              ))}
          </ul>
        )}

        <div className={styles.links}>
          <button type="button" className={styles.link} onClick={onChat}>
            <ChatCircleDots size={19} aria-hidden="true" />
            <span>Check in with Lis</span>
            <CaretRight size={15} aria-hidden="true" />
          </button>
          {setdownOpen ? null : (
            <button type="button" className={styles.link} onClick={() => setSetdownOpen(true)}>
              <HandPalm size={19} aria-hidden="true" />
              <span>Pause or set it down</span>
              <CaretRight size={15} aria-hidden="true" />
            </button>
          )}
          {goal.status === 'paused' || goal.status === 'released' ? (
            <button type="button" className={styles.link} onClick={() => void setStatus('active')}>
              <Compass size={19} aria-hidden="true" />
              <span>Pick this back up</span>
              <CaretRight size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {setdownOpen ? (
          <section
            ref={setdownRef}
            className={`${styles.setdown} kgRise`}
            aria-labelledby="goal-setdown-title"
          >
            <h3 id="goal-setdown-title">This does not have to be a failure.</h3>
            <p className={styles.muted}>
              Confirmed steps stay in Goals either way. Nothing is deducted, and you can
              pick this up any week.
            </p>
            <button type="button" className={styles.option} disabled={busy} onClick={() => void setStatus('paused')}>
              <Pause size={20} aria-hidden="true" />
              <span>
                <strong>Pause it</strong>
                <small>Off Home, still in Goals. No check-ins.</small>
              </span>
            </button>
            <button type="button" className={styles.option} disabled={busy} onClick={() => void setStatus('released')}>
              <HandPalm size={20} aria-hidden="true" />
              <span>
                <strong>Set it down</strong>
                <small>Closed, with the trail kept. Not marked as failed.</small>
              </span>
            </button>
            <button type="button" className={styles.option} disabled={busy} onClick={() => void setStatus('completed')}>
              <CheckCircle size={20} weight="fill" aria-hidden="true" />
              <span>
                <strong>It actually happened</strong>
                <small>{doneLooks.trim() || next?.title || 'Close it as reached.'}</small>
              </span>
            </button>
            <button type="button" className={styles.textLink} onClick={() => setSetdownOpen(false)}>
              Keep going for now
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
