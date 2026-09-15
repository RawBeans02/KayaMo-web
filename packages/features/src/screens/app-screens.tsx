'use client';

import {
  Barcode,
  BookOpenText,
  CaretRight,
  CheckCircle,
  Circle,
  Clock,
  Compass,
  ForkKnife,
  GearSix,
  Heartbeat,
  MagnifyingGlass,
  Microphone,
  Plus,
  Target,
  Tree,
  UsersThree,
} from '@phosphor-icons/react';
import {
  COMPANION_STAGES,
  LIFE_AREA_LABELS,
  type GuidanceSnapshot,
  type LifeArea,
  type MacroProgress,
  type NutritionProgress,
  type NutritionTargetView,
  type WeightTrendPoint,
} from '@kayamo/core';
import { asMealSlot, mealSlotLabel, orderedMealSlots, shiftLogicalDate, type Locale } from '@kayamo/food/quick-log';
import {
  type LocalBusyBlock,
  type LocalDailyPlan,
  type LocalFocusSession,
  type LocalFoodEntry,
  type LocalGoal,
  type LocalInboxItem,
  type LocalLifeStoryEntry,
  type LocalRoutine,
  type LocalRoutineCompletion,
  type LocalScripturePassage,
  type LocalTask,
  type LocalWeightLog,
  type LocalWorkout,
} from '@kayamo/offline';
import { ActionDialog, AppScreenHeader, EmptyLine } from './chrome';
import { greeting, progressionEvent, stageLabel, titleDate } from './copy';
import { DayStrip, PastDayBanner, WeekBars } from './day-strip';
import { MusHabitat } from './mus-habitat';
import { SyncStatusBar } from '../sync/sync-status-bar';
import styles from './kayamo-app.module.css';

export function HomeScreen({
  date,
  recommended,
  completedCount,
  foodCount,
  progress,
  homeGoal,
  homeGoalSteps,
  inboxDraft,
  inboxItems,
  onInboxDraft,
  onCaptureInbox,
  onPlan,
  onStart,
  onGrove,
  onOpenGoal,
  onChat,
  onBecome,
  onWeeklyReset,
  futureSelf,
  welcomeBack,
  resetDue,
  busyBlocks,
  onAddCommitment,
  onRemoveCommitment,
  voiceAvailable,
  voiceListening,
  onVoice,
}: {
  date: Date;
  recommended: string | null;
  completedCount: number;
  foodCount: number;
  progress: { totalPoints: number; stageKey: string };
  homeGoal: LocalGoal | null;
  homeGoalSteps: number;
  inboxDraft: string;
  inboxItems: LocalInboxItem[];
  onInboxDraft: (value: string) => void;
  onCaptureInbox: (event: React.FormEvent) => void;
  onPlan: () => void;
  onStart: () => void;
  onGrove: () => void;
  onOpenGoal: () => void;
  onChat: () => void;
  onBecome: () => void;
  onWeeklyReset: () => void;
  futureSelf: string | null;
  welcomeBack: boolean;
  resetDue: boolean;
  busyBlocks: LocalBusyBlock[];
  onAddCommitment: () => void;
  onRemoveCommitment: (id: string) => void;
  voiceAvailable: boolean;
  voiceListening: boolean;
  onVoice: () => void;
}) {
  const weeks = homeGoal
    ? Math.max(1, Math.floor(Math.max(0, Date.now() - Date.parse(homeGoal.created_at)) / 604_800_000) + 1)
    : 1;
  return (
    <div className={`${styles.screen} ${styles.homeScreen}`}>
      <header className={styles.homeHeader}>
        <div className={styles.homeTop}>
          <p className={styles.eyebrow} suppressHydrationWarning>
            {titleDate(date)}
          </p>
          <SyncStatusBar className={styles.syncChip} />
        </div>
        <h2 suppressHydrationWarning>{greeting(date)}</h2>
        <p className={styles.homeLead}>
          {welcomeBack
            ? 'Welcome back. Nothing was taken away.'
            : recommended
              ? 'One thing matters now. Kai is holding the rest.'
              : 'Nothing is planned yet. That is allowed.'}
        </p>
      </header>
      <MusHabitat progress={progress} onGrove={onGrove} />
      {welcomeBack ? (
        <p className={`${styles.mutedNote} ${styles.homeNote}`}>
          We will not dump overdue work on today. Plan one realistic step.
        </p>
      ) : null}
      {!futureSelf ? (
        <button type="button" className={styles.workingToward} onClick={onBecome}>
          <Compass size={22} />
          <span>
            <b>Becoming</b>
            <strong>Who are you trying to become?</strong>
            <small>A sentence is enough. Skip anytime.</small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : (
        <p className={`${styles.mutedNote} ${styles.homeNote}`}>{futureSelf}</p>
      )}
      {resetDue ? (
        <button type="button" className={styles.workingToward} onClick={onWeeklyReset}>
          <Tree size={22} />
          <span>
            <b>Weekly Reset</b>
            <strong>A look at the week, not a score</strong>
            <small>Unfinished stays off today until you choose.</small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : null}
      {homeGoal ? (
        <button type="button" className={styles.workingToward} onClick={onOpenGoal}>
          <Compass size={22} />
          <span>
            <b>Working toward</b>
            <strong>{homeGoal.title}</strong>
            <small>
              {homeGoalSteps} {homeGoalSteps === 1 ? 'step' : 'steps'} · week {weeks}
            </small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : null}
      <section className={styles.actionCard}>
        <div className={styles.missionEyebrow}>
          <p>{recommended ? 'Next on your list' : 'Nothing planned'}</p>
          {recommended ? <span>confirmed</span> : null}
        </div>
        <h3>{recommended ?? 'Want to put one thing on today?'}</h3>
        <p className={styles.muted}>{recommended ? 'Kai is reminding you, not changing your plan.' : 'Kai will not fill your day without you.'}</p>
        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} type="button" onClick={recommended ? onStart : onPlan}>
            {recommended ? 'Start' : 'Plan today'}
          </button>
          <button className={styles.secondaryButton} type="button" onClick={recommended ? onPlan : onChat}>
            {recommended ? 'Change' : 'Ask Kai'}
          </button>
        </div>
      </section>
      <section className={styles.inboxCapture}>
        <p className={styles.eyebrow}>Already committed · not a calendar sync</p>
        {busyBlocks.length === 0 ? (
          <p className={styles.emptyLine}>No hours named yet. Add class, shift, or an appointment if today is already taken.</p>
        ) : (
          <ul className={styles.plainList}>
            {busyBlocks.map((row) => (
              <li key={row.id}>
                <button type="button" className={styles.textLink} onClick={() => onRemoveCommitment(row.id)}>
                  {row.title}
                  {row.starts_at && row.ends_at ? ` · ${row.starts_at}–${row.ends_at}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className={styles.secondaryButton} type="button" onClick={onAddCommitment}>
          Add hours
        </button>
      </section>
      <section className={styles.inboxCapture}>
        <p className={styles.eyebrow}>Life Inbox</p>
        <h3>Park it here</h3>
        <p className={styles.muted}>Private by default. Kai cannot read this until you allow it.</p>
        <form onSubmit={onCaptureInbox}>
          <label className={styles.srOnly} htmlFor="life-inbox">Life Inbox</label>
          <textarea
            id="life-inbox"
            rows={2}
            value={inboxDraft}
            onChange={(event) => onInboxDraft(event.target.value)}
            placeholder="A thought, a task, something you do not want to lose…"
          />
          <div className={styles.buttonRow}>
            <button className={styles.secondaryButton} type="submit" disabled={!inboxDraft.trim()}>
              Save privately
            </button>
            {voiceAvailable ? (
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={onVoice}
                disabled={voiceListening}
              >
                <Microphone size={16} /> {voiceListening ? 'Listening…' : 'Speak'}
              </button>
            ) : (
              <p className={styles.mutedNote}>Voice capture is not available in this browser.</p>
            )}
          </div>
        </form>
        {inboxItems.length > 0 ? (
          <p className={styles.inboxCount}>
            {inboxItems.length} unprocessed {inboxItems.length === 1 ? 'item' : 'items'}
          </p>
        ) : null}
      </section>
      {completedCount > 0 || foodCount > 0 ? (
        <section className={styles.confirmedLedger} aria-label="Confirmed activity today">
          <p className={styles.eyebrow}>Confirmed today</p>
          {completedCount > 0 ? <div><CheckCircle size={19} weight="fill" /><span>{completedCount} {completedCount === 1 ? 'action' : 'actions'} completed</span><small>today</small></div> : null}
          {foodCount > 0 ? <div><ForkKnife size={19} /><span>{foodCount} {foodCount === 1 ? 'item' : 'items'} logged</span><small>today</small></div> : null}
        </section>
      ) : null}
    </div>
  );
}

export function TodayScreen({
  embedded,
  date,
  todayLogical,
  viewLogicalDate,
  markedDays,
  onSelectDay,
  tasks,
  routines,
  completedRoutineIds,
  plan,
  sessions,
  reflection,
  onReflection,
  onSaveReflection,
  onAdd,
  onToggleTask,
  onCompleteRoutine,
  onFocus,
  onPlan,
  onChat,
}: {
  embedded?: boolean;
  date: Date;
  todayLogical: string;
  viewLogicalDate: string;
  markedDays: ReadonlySet<string>;
  onSelectDay: (iso: string) => void;
  tasks: LocalTask[];
  routines: LocalRoutine[];
  completedRoutineIds: Set<string>;
  plan: LocalDailyPlan | null;
  sessions: LocalFocusSession[];
  reflection: string;
  onReflection: (value: string) => void;
  onSaveReflection: () => void;
  onAdd: () => void;
  onToggleTask: (task: LocalTask) => void;
  onCompleteRoutine: (routine: LocalRoutine) => void;
  onFocus: () => void;
  onPlan: () => void;
  onChat: () => void;
}) {
  const openTasks = tasks.filter((task) => !task.completed_at);
  const doneTasks = tasks.filter((task) => task.completed_at);
  const openRoutines = routines.filter((routine) => !completedRoutineIds.has(routine.id));
  const doneRoutines = routines.filter((routine) => completedRoutineIds.has(routine.id));
  const confirmed = doneTasks.length + doneRoutines.length;
  const total = tasks.length + routines.length;
  return (
    <div className={embedded ? styles.homeToday : `${styles.screen} ${styles.listScreen}`}>
      {embedded ? null : (
        <AppScreenHeader title="Today" subtitle={`${titleDate(date)} · ${confirmed} of ${Math.max(total, confirmed)} confirmed`} onChat={onChat} />
      )}
      <DayStrip todayLogical={todayLogical} selected={viewLogicalDate} marked={markedDays} onSelect={onSelectDay} />
      <PastDayBanner visible={viewLogicalDate !== todayLogical} />
      <section className={styles.nextActionBar}>
        <div><p className={styles.eyebrow}>Next · on your list</p><h3>{plan?.selected_label_snapshot ?? 'Choose one honest next action'}</h3><span>{plan ? '25 min focus · saved on device' : 'Nothing is added until you confirm'}</span></div>
        <button type="button" onClick={plan ? onFocus : onPlan}>{plan ? 'Start' : 'Choose'}</button>
      </section>

      <section className={styles.todaySection}>
        <div className={styles.compactSectionTitle}><p className={styles.eyebrow}>Plan · {openTasks.length + openRoutines.length} open</p><button type="button" onClick={onAdd}><Plus size={17} /> Add</button></div>
        <div className={styles.plainList}>
          {openTasks.length === 0 && openRoutines.length === 0 ? <EmptyLine text="Nothing open. Keep the day light." /> : openTasks.map((task) => (
            <button key={task.id} className={styles.checkRow} type="button" onClick={() => onToggleTask(task)} aria-pressed={Boolean(task.completed_at)}>
              <Circle size={21} />
              <span><strong>{task.title}</strong><small>Scheduled for today</small></span>
              <span className={styles.rowMeta}>task</span>
            </button>
          ))}
          {openRoutines.map((routine) => (
            <button key={routine.id} className={styles.checkRow} type="button" onClick={() => onCompleteRoutine(routine)} aria-pressed={false}>
              <Circle size={21} />
              <span><strong>{routine.title}</strong><small>Repeats gently</small></span>
              <span className={styles.rowMeta}>habit</span>
            </button>
          ))}
        </div>
      </section>

      {doneTasks.length + doneRoutines.length > 0 ? <section className={styles.todaySection}>
        <p className={styles.eyebrow}>Done · stays visible</p>
        <div className={styles.plainList}>
          {doneTasks.map((task) => <button key={task.id} className={styles.checkRow} type="button" onClick={() => onToggleTask(task)} aria-pressed={true}><CheckCircle size={21} weight="fill" /><span className={styles.done}><strong>{task.title}</strong></span><small className={styles.rowMeta}>done</small></button>)}
          {doneRoutines.map((routine) => <button key={routine.id} className={styles.checkRow} type="button" disabled aria-pressed={true}><CheckCircle size={21} weight="fill" /><span className={styles.done}><strong>{routine.title}</strong></span><small className={styles.rowMeta}>done</small></button>)}
        </div>
      </section> : null}

      <section className={styles.focusSuggestion}>
        <p className={styles.eyebrow}>Focus</p>
        <h3>{plan ? `A 25-minute session on “${plan.selected_label_snapshot}” is the one Kai keeps suggesting.` : 'Choose one action and Kai can hold a quiet timer for it.'}</h3>
        <p>Timer and nudges only. KayaMo in the browser cannot block other apps.</p>
        {plan ? <button type="button" onClick={onFocus}><Clock size={17} /> Set up focus</button> : null}
        {sessions.filter((session) => session.status === 'completed').length > 0 ? <span className={styles.successLine}><CheckCircle weight="fill" /> {sessions.filter((session) => session.status === 'completed').length} completed</span> : null}
      </section>

      <section className={styles.reflectionCard}>
        <p className={styles.eyebrow}>Evening reflection · local only</p>
        <h3>What helped today?</h3>
        <textarea className={styles.inlineTextarea} value={reflection} onChange={(event) => onReflection(event.target.value)} rows={3} placeholder="A few honest words are enough." />
        <button className={styles.secondaryButton} type="button" onClick={onSaveReflection}>Save on this device</button>
      </section>
    </div>
  );
}

export function LifeScreen({
  areas,
  physicalSummary,
  circleSummary,
  onOpenPhysical,
  onOpenCircles,
  onChat,
}: {
  areas: LifeArea[];
  physicalSummary: string;
  circleSummary: string;
  onOpenPhysical: () => void;
  onOpenCircles: () => void;
  onChat: () => void;
}) {
  return (
    <div className={`${styles.screen} ${styles.listScreen}`}>
      <AppScreenHeader
        title="Life"
        subtitle="Physical Self is the deep slice. Circles stay optional and private-first."
        onChat={onChat}
      />
      {areas.map((area) =>
        area === 'physical' ? (
          <button type="button" className={styles.workingToward} key={area} onClick={onOpenPhysical}>
            <Heartbeat size={22} />
            <span>
              <b>Life area</b>
              <strong>Physical Self</strong>
              <small>{physicalSummary}</small>
            </span>
            <CaretRight size={16} />
          </button>
        ) : (
          <div key={area} className={styles.lifeShelf}>
            <span>
              <strong>{LIFE_AREA_LABELS[area]}</strong>
              <small>Set up later. Hidden areas stay gone without rebuilding the app.</small>
            </span>
          </div>
        ),
      )}
      <button type="button" className={styles.workingToward} onClick={onOpenCircles}>
        <UsersThree size={22} />
        <span>
          <b>Circles</b>
          <strong>Optional groups, not a feed</strong>
          <small>{circleSummary}</small>
        </span>
        <CaretRight size={16} />
      </button>
    </div>
  );
}

export function HealthScreen({
  entries,
  kcalProgress,
  macros,
  fiberG,
  locale,
  todayLogical,
  viewLogicalDate,
  markedDays,
  kcalByDate,
  onSelectDay,
  weights,
  weightTrend,
  weightChange,
  workouts,
  activeWorkout,
  guidance,
  guidanceStale,
  dayType,
  physicalGoals,
  trainingOnPlan,
  onOpenWorkout,
  onLogWeight,
  onOpenTargets,
  onOpenTrend,
  onOpenExpenditure,
  onLogFood,
  onScanBarcode,
  onEditEntry,
  onOpenGoal,
  onAddGoal,
  onPlanTraining,
  onChat,
  onBack,
}: {
  entries: LocalFoodEntry[];
  kcalProgress: NutritionProgress;
  macros: MacroProgress[];
  fiberG: number;
  locale: Locale;
  todayLogical: string;
  viewLogicalDate: string;
  markedDays: ReadonlySet<string>;
  kcalByDate: ReadonlyMap<string, number>;
  onSelectDay: (iso: string) => void;
  weights: LocalWeightLog[];
  weightTrend: WeightTrendPoint[];
  weightChange: { days: number; changeKg: number } | null;
  workouts: LocalWorkout[];
  activeWorkout: LocalWorkout | null;
  guidance: GuidanceSnapshot | null;
  guidanceStale: boolean;
  dayType: string;
  onOpenWorkout: () => void;
  onLogWeight: () => void;
  onOpenTargets: () => void;
  onOpenTrend: () => void;
  onOpenExpenditure: () => void;
  onLogFood: () => void;
  onScanBarcode: () => void;
  onEditEntry: (entry: LocalFoodEntry) => void;
  physicalGoals: LocalGoal[];
  trainingOnPlan: boolean;
  onOpenGoal: (goal: LocalGoal) => void;
  onAddGoal: () => void;
  onPlanTraining: () => void;
  onChat: () => void;
  onBack: () => void;
}) {
  const orderedWeights = [...weights]
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .slice(-7);
  const latestWeight = orderedWeights.at(-1);
  const weightValues = orderedWeights.map((row) => Number(row.weight_kg));
  const weightMin = Math.min(...weightValues);
  const weightMax = Math.max(...weightValues);
  const latestTrend = weightTrend.at(-1);
  const weeklyRateKg =
    weightChange && weightChange.days > 0
      ? (weightChange.changeKg / weightChange.days) * 7
      : null;
  const grouped = orderedMealSlots()
    .map((slot) => ({
      slot,
      rows: entries.filter((entry) => asMealSlot(entry.meal_slot) === slot),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className={`${styles.screen} ${styles.listScreen}`}>
      <AppScreenHeader
        title="Physical Self"
        subtitle={viewLogicalDate === todayLogical ? 'Food and gym live here. Numbers come from your records, not from Kai.' : 'You are looking at a past day.'}
        onChat={onChat}
        onBack={onBack}
      />
      <DayStrip todayLogical={todayLogical} selected={viewLogicalDate} marked={markedDays} onSelect={onSelectDay} />
      <PastDayBanner visible={viewLogicalDate !== todayLogical} />

      {physicalGoals.map((goal) => (
        <button type="button" className={styles.workingToward} key={goal.id} onClick={() => onOpenGoal(goal)}>
          <Compass size={22} />
          <span>
            <b>Working toward</b>
            <strong>{goal.title}</strong>
            <small>Lives with this area, and on Goals.</small>
          </span>
          <CaretRight size={16} />
        </button>
      ))}
      <button type="button" className={styles.workingToward} onClick={onAddGoal}>
        <Heartbeat size={22} />
        <span>
          <b>Physical goal</b>
          <strong>Add one that belongs here</strong>
          <small>Optional. Food and training still work without it.</small>
        </span>
        <CaretRight size={16} />
      </button>

      <section className={styles.healthSection}>
        <p className={styles.eyebrow}>Food · {viewLogicalDate === todayLogical ? 'today' : viewLogicalDate}</p>
        <div className={styles.nutritionCard}>
          <div className={styles.calorieLine}>
            <strong>{kcalProgress.eatenKcal}</strong>
            {kcalProgress.targetKcal === null ? (
              <span>kcal logged today · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
            ) : (
              <span>
                of {kcalProgress.targetKcal} kcal ·{' '}
                {kcalProgress.over
                  ? `${Math.abs(kcalProgress.remainingKcal ?? 0)} over`
                  : `${kcalProgress.remainingKcal} left`}
              </span>
            )}
          </div>
          {kcalProgress.percent === null ? null : (
            <div
              className={styles.kcalTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={kcalProgress.targetKcal ?? 0}
              aria-valuenow={kcalProgress.eatenKcal}
              aria-label="Calories logged against today's target"
            >
              <b
                className={kcalProgress.over ? styles.kcalOver : undefined}
                style={{ width: `${kcalProgress.percent}%` }}
              />
            </div>
          )}
          <div className={styles.macroRow}>
            {macros.map((macro) => (
              <div key={macro.key}>
                <span>{macro.label}</span>
                <strong>{macro.eatenG}g</strong>
                {macro.targetG === null ? null : <small>of {macro.targetG}g</small>}
              </div>
            ))}
            {kcalProgress.targetKcal === null ? null : (
              <button className={styles.macroLink} type="button" onClick={onOpenTargets}>
                Targets
              </button>
            )}
          </div>
          {fiberG > 0 ? (
            <p className={styles.mutedNote}>{Math.round(fiberG)}g fiber logged. No fiber target, and we do not invent one.</p>
          ) : null}
        </div>
        {kcalProgress.targetKcal === null ? (
          <GuidanceSetupNote guidance={guidance} onOpenTargets={onOpenTargets} />
        ) : null}
        {guidanceStale ? (
          <p className={styles.mutedNote}>
            Showing the last targets saved on this device. They refresh when you reconnect.
          </p>
        ) : null}
      </section>

      <section className={styles.healthSection}>
        {entries.length === 0 ? (
          <div className={styles.plainList}>
            <EmptyLine text="Nothing logged yet. Honest logging is the goal." />
          </div>
        ) : (
          grouped.map((group) => (
            <div className={styles.mealGroup} key={group.slot}>
              <p className={styles.mealGroupLabel}>{mealSlotLabel(group.slot, locale)}</p>
              <div className={styles.plainList}>
                {group.rows.map((entry) => (
                  <button className={`${styles.dataRow} ${styles.dataRowButton}`} type="button" key={entry.id} onClick={() => onEditEntry(entry)}>
                    <div>
                      <strong>{entry.food_name_snapshot}</strong>
                      <span>{entry.serving_label_snapshot ?? `${entry.grams} g`}</span>
                    </div>
                    <span>
                      <strong>{Math.round(Number(entry.kcal))}</strong>
                      <small>
                        {entry.source} · {Math.round(Number(entry.confidence) * 100)}%
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
        <div className={styles.healthPrimaryActions}>
          <button type="button" onClick={onLogFood}>
            <MagnifyingGlass size={18} weight="bold" /> Log food
          </button>
          <button type="button" onClick={onScanBarcode} aria-label="Scan barcode">
            <Barcode size={21} />
          </button>
        </div>
      </section>

      <WeekBars todayLogical={todayLogical} kcalByDate={kcalByDate} selected={viewLogicalDate} />

      <section className={styles.healthSection}>
        <p className={styles.eyebrow}>Weight &amp; guidance</p>
        <div className={styles.weightCard}>
          <div className={styles.weightHeadline}>
            <div>
              <strong>{latestWeight ? Number(latestWeight.weight_kg).toFixed(1) : '—'}</strong>
              <span> kg</span>
              <p>
                {latestTrend && weeklyRateKg !== null && weightChange
                  ? `Trend ${latestTrend.trendWeightKg.toFixed(1)} kg · ${
                      weeklyRateKg < 0 ? 'down' : 'up'
                    } ${Math.abs(weeklyRateKg).toFixed(2)} kg/week over ${weightChange.days} days`
                  : latestWeight
                    ? `Last logged ${latestWeight.measured_on}`
                    : 'No weight logged yet'}
              </p>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={onLogWeight}>
              Log weight
            </button>
          </div>
          {orderedWeights.length >= 2 ? (
            <div
              className={styles.weightBars}
              aria-label={`Weight trend across ${orderedWeights.length} confirmed measurements`}
            >
              {orderedWeights.map((row) => (
                <i
                  key={row.id}
                  style={{
                    height: `${35 + ((Number(row.weight_kg) - weightMin) / Math.max(0.1, weightMax - weightMin)) * 55}%`,
                  }}
                />
              ))}
            </div>
          ) : null}
          <div className={styles.guidanceActions}>
            {latestTrend ? (
              <button type="button" onClick={onOpenTrend}>How the trend works</button>
            ) : null}
            {guidance?.expenditure ? (
              <button type="button" onClick={onOpenExpenditure}>Expenditure</button>
            ) : null}
          </div>
          <p>
            {guidance?.expenditure
              ? `Estimated expenditure ${Math.round(guidance.expenditure.tdeeKcal)} kcal · reading today as a ${dayType} day.`
              : 'Guidance appears only from confirmed records and code-derived safety rules.'}
          </p>
        </div>
      </section>

      <section className={styles.healthSection}>
        <p className={styles.eyebrow}>Fitness</p>
        <div className={styles.trainingCard}>
          <h3>{activeWorkout ? 'Workout in progress' : trainingOnPlan ? 'Training is on today' : 'Ready when you are'}</h3>
          <p>{activeWorkout ? 'This session is saved locally and survives a reconnect.' : `${workouts.filter((row) => row.status === 'completed').length} completed workouts in history.`}</p>
          <div>
            <button type="button" onClick={onOpenWorkout}>
              {activeWorkout ? 'Continue workout' : 'Start workout'}
            </button>
            {trainingOnPlan || activeWorkout ? null : (
              <button type="button" className={styles.secondaryButton} onClick={onPlanTraining}>
                Put on today
              </button>
            )}
            <span className={styles.secondaryActionLabel}>{workouts.length} logged</span>
          </div>
        </div>
      </section>

      <p className={styles.safetyNote}>Health progress never earns rewards for eating less, losing weight, or training through pain.</p>
    </div>
  );
}

const DAY_TYPE_NOTES: Record<string, string> = {
  training: 'Training days carry more carbohydrate to fuel the session.',
  rest: 'Rest days sit closest to the plain estimate.',
  refeed: 'A refeed day deliberately returns to maintenance.',
  deload: 'Deload weeks lower the training load, not the food.',
};

/** Clamp reasons come from the target engine, never from prompt text. */
const CLAMP_REASON_COPY: Record<string, string> = {
  calorie_floor: 'Raised to the calorie floor set in code.',
  max_deficit: 'Held at the maximum safe deficit for your expenditure.',
  max_weekly_rate: 'Slowed to the maximum safe weekly rate.',
};

export function TargetsDialog({
  open,
  onClose,
  guidance,
  dayType,
  recomputing,
  onRecompute,
  onLogWeight,
}: {
  open: boolean;
  onClose: () => void;
  guidance: GuidanceSnapshot | null;
  dayType: string;
  recomputing: boolean;
  onRecompute: () => void;
  onLogWeight: () => void;
}) {
  const targets = guidance?.targets ?? [];
  const active = targets.find((row) => row.dayType === dayType) ?? null;
  const clampReasons = [...new Set(targets.flatMap((row) => row.clampReasons))];

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Your daily targets"
      description="Generated in code from your confirmed records. Kai never sets these numbers."
    >
      <div className={styles.readingStack}>
        {targets.length === 0 ? (
          <>
            <p>
              No targets yet. They need your sex, birth year, height, activity baseline, and
              goal on your profile, plus at least one weight log.
            </p>
            {guidance && !guidance.profile.complete ? (
              <p className={styles.mutedNote}>
                Still needed: {guidance.profile.missing.map((field) => field.replaceAll('_', ' ')).join(', ')}.
              </p>
            ) : null}
            <button className={styles.secondaryButton} type="button" onClick={onLogWeight}>
              Log a weight
            </button>
          </>
        ) : (
          <>
            <TargetTable targets={targets} dayType={dayType} />
            {active ? (
              <p className={styles.mutedNote}>
                {DAY_TYPE_NOTES[active.dayType] ?? ''} Weekly rate {active.weeklyRatePercent}% of
                body weight · confidence {Math.round(active.confidence * 100)}%.
              </p>
            ) : null}
            {clampReasons.length > 0 ? (
              <div className={styles.safetyBlock}>
                <p className={styles.eyebrow}>Safety limits applied</p>
                <ul>
                  {clampReasons.map((reason) => (
                    <li key={reason}>{CLAMP_REASON_COPY[reason] ?? reason.replaceAll('_', ' ')}</li>
                  ))}
                </ul>
                <p className={styles.mutedNote}>
                  Floors and the deficit ceiling are enforced in code. They cannot be lowered by
                  asking Kai.
                </p>
              </div>
            ) : null}
          </>
        )}
        <button
          className={styles.primaryButton}
          type="button"
          onClick={onRecompute}
          disabled={recomputing}
        >
          {recomputing ? 'Recomputing…' : 'Recompute from my records'}
        </button>
      </div>
    </ActionDialog>
  );
}

export function TargetTable({
  targets,
  dayType,
}: {
  targets: readonly NutritionTargetView[];
  dayType: string;
}) {
  return (
    <table className={styles.targetTable}>
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">kcal</th>
          <th scope="col">P</th>
          <th scope="col">C</th>
          <th scope="col">F</th>
        </tr>
      </thead>
      <tbody>
        {targets.map((row) => (
          <tr key={row.dayType} aria-current={row.dayType === dayType ? 'true' : undefined}>
            <th scope="row">{row.dayType}</th>
            <td>{Math.round(row.kcal)}</td>
            <td>{Math.round(row.proteinG)}</td>
            <td>{Math.round(row.carbsG)}</td>
            <td>{Math.round(row.fatG)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Targets need a goal, a weight, and an expenditure estimate. Naming the
 * missing piece is more useful than hiding the target line with no reason.
 */
export function GuidanceSetupNote({
  guidance,
  onOpenTargets,
}: {
  guidance: GuidanceSnapshot | null;
  onOpenTargets: () => void;
}) {
  if (!guidance) {
    return <p className={styles.mutedNote}>Targets load when you are back online.</p>;
  }
  const needsProfile = !guidance.profile.complete;
  return (
    <div className={styles.setupNote}>
      <p>
        {needsProfile
          ? 'A daily target needs your sex, birth year, height, activity baseline, and goal.'
          : 'A daily target needs at least one weight log so expenditure can be estimated.'}
      </p>
      <button className={styles.secondaryButton} type="button" onClick={onOpenTargets}>
        Set up targets
      </button>
    </div>
  );
}

export function JourneyScreen({ mode, goals, tasks, routines, routineCompletions, workouts, foodEntries, progress, presenceDates, todayLogical, recordsNote = null, storyEntries = [], musLite = false, faithEnabled, scripture, onAddGoal, onOpenGoal, onOpenSettings, onWeeklyReset, onCloseChapter, onChat }: {
  mode: 'goals' | 'grove';
  goals: LocalGoal[];
  tasks: LocalTask[];
  routines: LocalRoutine[];
  routineCompletions: LocalRoutineCompletion[];
  workouts: LocalWorkout[];
  foodEntries: LocalFoodEntry[];
  progress: { totalPoints: number; stageKey: string; acceptedEventKeys: string[] };
  presenceDates: string[];
  todayLogical: string;
  recordsNote?: string | null;
  storyEntries?: LocalLifeStoryEntry[];
  musLite?: boolean;
  faithEnabled: boolean;
  scripture: LocalScripturePassage[];
  onAddGoal: () => void;
  onOpenGoal: (goal: LocalGoal) => void;
  onOpenSettings: () => void;
  onWeeklyReset?: () => void;
  onCloseChapter?: () => void;
  onChat: () => void;
}) {
  const trace = progress.acceptedEventKeys.slice(-5).reverse();
  const eventLabels = new Map<string, string>([
    ...tasks.map((task) => [task.id, task.title] as const),
    ...routines.map((routine) => [routine.id, routine.title] as const),
    ...routineCompletions.map((completion) => [completion.id, routines.find((routine) => routine.id === completion.routine_id)?.title ?? 'Routine completed'] as const),
    ...goals.map((goal) => [goal.id, goal.title] as const),
    ...workouts.map((workout) => [workout.id, 'Completed workout'] as const),
    ...foodEntries.map((entry) => [entry.id, entry.food_name_snapshot] as const),
  ]);
  const presenceSet = new Set(presenceDates);
  const last28 = Array.from({ length: 28 }, (_, index) => shiftLogicalDate(todayLogical, index - 27));
  const presentCount = last28.filter((iso) => presenceSet.has(iso)).length;
  const goalList = (
    <section className={styles.journeySection}>
      <div className={styles.compactSectionTitle}><p className={styles.eyebrow}>Goals you confirmed</p><button type="button" onClick={onAddGoal}><Plus size={17} /> Add</button></div>
      <div className={styles.goalList}>
        {goals.length === 0 ? <EmptyLine text="No goals yet. Start with something that matters to you." /> : goals.map((goal) => (
          <button key={goal.id} className={styles.checkRow} type="button" onClick={() => onOpenGoal(goal)}>
            {goal.status === 'completed' ? <CheckCircle size={23} weight="fill" /> : <Target size={23} />}
            <span className={goal.status === 'completed' ? styles.done : ''}>{goal.title}</span>
            <span className={styles.rowMeta}>{goal.status}</span>
          </button>
        ))}
      </div>
    </section>
  );
  if (mode === 'goals') {
    return (
      <div className={`${styles.screen} ${styles.listScreen}`}>
        <AppScreenHeader title="Goals" subtitle="One thing at a time, big enough to matter" onChat={onChat} />
        {goalList}
      </div>
    );
  }
  return (
    <div className={`${styles.screen} ${styles.listScreen}`}>
      <AppScreenHeader title="Grove" subtitle={`${progress.totalPoints} points from confirmed actions`} onChat={onChat} />
      {onWeeklyReset ? (
        <button type="button" className={styles.workingToward} onClick={onWeeklyReset}>
          <Tree size={22} />
          <span>
            <b>Weekly Reset</b>
            <strong>Review goals and unfinished work</strong>
            <small>Nothing is dumped onto today from here.</small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : null}
      {onCloseChapter ? (
        <button type="button" className={styles.workingToward} onClick={onCloseChapter}>
          <BookOpenText size={22} />
          <span>
            <b>Close this chapter</b>
            <strong>What changed, what carries forward</strong>
            <small>Points stay. The tree does not die.</small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : null}
      <section className={styles.journeySection}>
        <p className={styles.eyebrow}>Life Story</p>
        {storyEntries.length === 0 ? (
          <p className={styles.emptyLine}>Nothing confirmed into the story yet. Completing or setting down a goal can be kept here.</p>
        ) : (
          <div className={styles.traceList}>
            {storyEntries.slice(0, musLite ? 3 : 12).map((row) => (
              <div key={row.id}>
                <CheckCircle size={18} weight="fill" />
                <span>
                  <strong>{row.title}</strong>
                  <small>
                    {row.happened_on}
                    {row.kind === 'goal_released' ? ' · set down' : ''}
                    {row.professional ? ' · professional' : ''}
                  </small>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      {musLite ? null : (
        <section className={styles.journeySection}>
          <p className={styles.eyebrow}>From your records</p>
          <p className={styles.mutedNote}>
            {recordsNote ?? 'Not enough confirmed days yet for a pattern. That is allowed.'}
          </p>
        </section>
      )}
      <section className={styles.journeySection}>
        <p className={styles.eyebrow}>Stages</p>
        <div className={styles.surfaceCard}>
          {COMPANION_STAGES.map((stage, index) => {
            const current = stage.key === progress.stageKey;
            const reached = progress.totalPoints >= stage.minimumPoints;
            return (
              <div className={styles.ladderRow} key={stage.key}>
                {index === 0 ? (
                  <span className={styles.ladderArt}>
                    <img src="/coco-seed.webp" alt="" width={38} height={38} />
                  </span>
                ) : (
                  <span className={styles.ladderGhost}>art</span>
                )}
                <span>
                  <strong>{stageLabel(stage.key)}</strong>
                  <small>from {stage.minimumPoints} points</small>
                </span>
                <span className={styles.ladderTag} data-on={current ? '1' : undefined}>
                  {current ? 'now' : reached ? 'reached' : 'later'}
                </span>
              </div>
            );
          })}
          <p className={styles.mutedNote}>Four stage illustrations are still missing. The rows hold their place rather than repeating the seed.</p>
        </div>
      </section>
      <section className={styles.journeySection}>
        <p className={styles.eyebrow}>What produced this progress</p>
        <p className={styles.sectionNote}>Every point came from something you confirmed. Nothing rewards restriction, weight lost, or a perfect streak.</p>
        <div className={styles.traceList}>
          {trace.length === 0 ? <EmptyLine text="No progress events yet. Your first confirmed action will appear here." /> : trace.map((eventKey) => {
            const sourceId = eventKey.split(':')[2];
            const event = progressionEvent(eventKey, sourceId ? eventLabels.get(sourceId) : undefined);
            return <div key={eventKey}><CheckCircle size={18} weight="fill" /><span><strong>{event.label}</strong><small>{event.detail}</small></span><b>+{event.points}</b></div>;
          })}
        </div>
      </section>
      <section className={styles.presenceSection}>
        <p className={styles.eyebrow}>Presence · last 28 days</p>
        <div className={styles.surfaceCard}>
          <div className={styles.presenceGrid} role="img" aria-label={`${presentCount} of the last 28 days have a confirmed action`}>
            {last28.map((iso) => (
              <i key={iso} data-active={presenceSet.has(iso) ? '' : undefined} />
            ))}
          </div>
          <div className={styles.presenceLegend}>
            <span><i data-on />confirmed</span>
            <span><i />quiet</span>
          </div>
          <p>
            {presentCount} {presentCount === 1 ? 'day' : 'days'} with something confirmed. Quiet days take nothing away, and there is no streak to break.
          </p>
        </div>
      </section>
      {faithEnabled ? (
        <section className={styles.faithCard}>
          <p className={styles.eyebrow}>Faith mode · reviewed Scripture</p>
          {scripture[0] ? <><blockquote>“{scripture[0].text}”</blockquote><cite>{scripture[0].reference} · World English Bible</cite></> : <p>Reviewed passages will appear here when available.</p>}
          <p className={styles.muted}>Kai can support reflection, but is not a theological authority.</p>
        </section>
      ) : (
        <button className={styles.faithInvite} type="button" onClick={onOpenSettings}>
          <BookOpenText size={24} /><span><strong>Optional faith mode</strong><small>Enable Scripture and private prayer reflections when you want them.</small></span><CaretRight size={20} />
        </button>
      )}
      <button className={styles.settingsEntry} type="button" onClick={onOpenSettings}>
        <GearSix size={20} /><span>Settings and privacy</span><CaretRight size={18} />
      </button>
    </div>
  );
}

