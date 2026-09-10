'use client';

import {
  addGymPlannedSet,
  addGymSessionItem,
  attachGymDraftToWorkout,
  clearLocalRestTimer,
  cloneGymSessionToDraft,
  completeLocalWorkoutSet,
  duplicateGymSessionItem,
  finishLocalWorkout,
  getLocalGymPrefs,
  gymDraftSessionId,
  listGymBusyEquipment,
  listGymPlannedSets,
  listGymSessionItems,
  listLocalWorkoutHistory,
  listLocalWorkoutSets,
  recoverClosedOfflineDb,
  refreshGymItemState,
  removeFutureGymPlannedSet,
  reorderGymSessionItem,
  saveLocalGymPrefs,
  startLocalRestTimer,
  startLocalWorkout,
  substituteGymSessionItem,
  toggleGymBusyEquipment,
  tombstoneLocalWorkoutSet,
  updateGymPlannedSet,
  updateGymSessionItem,
  type LocalGymPlannedSet,
  type LocalGymSessionItem,
  type LocalWorkout,
  type LocalWorkoutSet,
} from '@kayamo/offline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import { bindConsultToCatalog, type BoundConsult } from '../gym/consult';
import { gymConsultSchema } from '../gym/consult-schema';
import { catalogExerciseId, exerciseBySlug, GYM_CATALOG, listedSubstitutes, searchCatalog, type CatalogExercise } from '../gym/library';
import { lastLoadKg, lastSessionSets } from '../gym/last-load';
import { familyOverlapWarnings } from '../gym/redundancy';
import { formatRestClock, sessionElapsedSeconds } from '../gym/session-clock';
import styles from '../food/desk.module.css';
import { DeskMusPane } from './desk-mus';
import { GymRestBar } from './gym-rest';
import { useGymSession } from './gym-session-provider';
import { useDeskClock } from './use-desk-clock';

const BUSY_GEAR = [
  { id: 'cable', label: 'Cable station' },
  { id: 'machine', label: 'Machine' },
  { id: 'smith_machine', label: 'Smith machine' },
  { id: 'hack_squat', label: 'Hack squat' },
];

function formatTime(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

function nextSetIndex(sets: LocalWorkoutSet[], exerciseId: string): number {
  return sets
    .filter((row) => row.exercise_id === exerciseId)
    .reduce((max, row) => Math.max(max, row.set_index + 1), 0);
}

function setsDone(planned: LocalGymPlannedSet[]): number {
  return planned.filter((row) => row.performed_set_id).length;
}

function liftNeedsBusyStation(slug: string, busyGear: string[]): boolean {
  if (busyGear.length === 0) return false;
  const catalog = exerciseBySlug(slug);
  if (!catalog) return busyGear.some((id) => slug.includes(id));
  return catalog.requiredEquipment.some((id) => busyGear.includes(id));
}

function sourceTag(source: LocalGymSessionItem['source']): string {
  if (source === 'ai') return 'Mus';
  if (source === 'copy') return 'copy';
  if (source === 'live') return 'live';
  return 'you';
}

export function GymDesk({ userId }: { userId: string }) {
  const { clock, today } = useDeskClock(userId);
  const session = useGymSession();
  const draftId = gymDraftSessionId(userId);
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [sets, setSets] = useState<LocalWorkoutSet[]>([]);
  const [historySets, setHistorySets] = useState<LocalWorkoutSet[]>([]);
  const [items, setItems] = useState<LocalGymSessionItem[]>([]);
  const [plannedByItem, setPlannedByItem] = useState<Map<string, LocalGymPlannedSet[]>>(new Map());
  const [openId, setOpenId] = useState<string | null>(null);
  const [actuals, setActuals] = useState<Record<string, { kg: string; reps: string; rir: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [consult, setConsult] = useState<BoundConsult | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [busyGear, setBusyGear] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [sessionPaused, setSessionPaused] = useState(false);
  const [pauseOffsetSec, setPauseOffsetSec] = useState(0);
  const [pauseStartedMs, setPauseStartedMs] = useState<number | null>(null);

  const active = workouts.find((row) => row.status === 'active') ?? null;
  const sessionId = active?.id ?? draftId;

  const load = useCallback(async () => {
    try {
      await recoverClosedOfflineDb(async () => {
        const history = await listLocalWorkoutHistory(userId);
        const todayRows = history.filter((row) => row.logical_date === today || row.status === 'active');
        setWorkouts(todayRows);
        const recent = history.slice(0, 12);
        const nested = await Promise.all(recent.map((row) => listLocalWorkoutSets(row.id)));
        setHistorySets(nested.flat());
        const live = todayRows.find((row) => row.status === 'active') ?? null;
        const sid = live?.id ?? draftId;
        if (live) {
          setSets(await listLocalWorkoutSets(live.id));
        } else {
          setSets([]);
        }
        const queue = await listGymSessionItems(userId, sid);
        setItems(queue);
        const planned = new Map<string, LocalGymPlannedSet[]>();
        await Promise.all(
          queue.map(async (item) => {
            planned.set(item.id, await listGymPlannedSets(userId, item.id));
          }),
        );
        setPlannedByItem(planned);
        const gear = await listGymBusyEquipment(userId, today);
        setBusyGear(gear.map((row) => row.equipment_id));
        const prefs = await getLocalGymPrefs(userId);
        setAvoid(prefs.avoid_slugs);
        setFavorites(prefs.favorite_slugs);
      });
    } catch {
      // IndexedDB can close during auth/scope switch; the next tick retries.
    }
  }, [draftId, today, userId]);

  useEffect(() => {
    void load();
    const timerId = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timerId);
  }, [load]);

  useEffect(() => {
    setSessionPaused(false);
    setPauseOffsetSec(0);
    setPauseStartedMs(null);
  }, [active?.id]);

  const overlap = useMemo(
    () =>
      familyOverlapWarnings(
        items
          .filter((row) => row.state !== 'SKIPPED' && row.state !== 'SUBSTITUTED')
          .map((row) => ({
            slug: row.slug,
            exerciseName: row.exercise_name,
            familyId: exerciseBySlug(row.slug)?.familyId,
          })),
        GYM_CATALOG,
      ),
    [items],
  );

  async function addLift(exercise: CatalogExercise, source: LocalGymSessionItem['source'] = 'manual') {
    setError(null);
    const prior = lastLoadKg(historySets, exercise.name);
    await addGymSessionItem({
      userId,
      sessionId,
      slug: exercise.slug,
      exerciseName: exercise.name,
      source: active ? 'live' : source,
      targetSets: 3,
      targetReps: exercise.defaultRepMin,
      targetWeightKg: prior ? Number(prior) : null,
    });
    setOpenId(null);
    await load();
  }

  async function onStart() {
    setError(null);
    setBusy(true);
    try {
      const workout = await startLocalWorkout({
        userId,
        timeZone: clock.timeZone,
        dayStartsAt: clock.dayStartsAt,
        notes: note.trim() || null,
      });
      await attachGymDraftToWorkout({ userId, workoutId: workout.id });
      await load();
      await session.refresh();
    } catch {
      setError('Could not start a session.');
    } finally {
      setBusy(false);
    }
  }

  async function onFinish() {
    if (!active) return;
    setBusy(true);
    try {
      await clearLocalRestTimer(active.id);
      await finishLocalWorkout({ id: active.id, userId });
      await load();
      await session.refresh();
    } catch {
      setError('Could not finish that session.');
    } finally {
      setBusy(false);
    }
  }

  async function onCopyLast() {
    if (active) { setError('Finish this session before copying another workout.'); return; }
    const last = workouts.find((row) => row.status === 'completed') ??
      (await listLocalWorkoutHistory(userId)).find((row) => row.status === 'completed');
    if (!last) {
      setError('No finished session to copy yet.');
      return;
    }
    const sourceItems = await listGymSessionItems(userId, last.id);
    if (sourceItems.length > 0) {
      await cloneGymSessionToDraft({ userId, fromSessionId: last.id });
      await load();
      return;
    }
    const lastSets = await listLocalWorkoutSets(last.id);
    const order: string[] = [];
    const grouped = new Map<string, LocalWorkoutSet[]>();
    for (const row of lastSets) {
      if (!grouped.has(row.exercise_id)) order.push(row.exercise_id);
      grouped.set(row.exercise_id, [...(grouped.get(row.exercise_id) ?? []), row]);
    }
    for (const exerciseId of order) {
      const group = grouped.get(exerciseId) ?? [];
      const name = group[0]?.exercise_name_snapshot ?? 'Lift';
      const match = GYM_CATALOG.find((row) => row.name.toLowerCase() === name.toLowerCase());
      if (!match) continue;
      await addGymSessionItem({
        userId,
        sessionId: draftId,
        slug: match.slug,
        exerciseName: match.name,
        source: 'copy',
        targetSets: group.length,
        targetReps: group[group.length - 1]?.reps,
        targetWeightKg: Number(group[group.length - 1]?.weight_kg),
      });
    }
    await load();
  }

  async function onConsult() {
    setBusy(true);
    setError(null);
    try {
      const recentLifts = [...new Set(historySets.map((row) => row.exercise_name_snapshot))].slice(0, 24);
      const response = await apiFetch('/api/gym/consult', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          logicalDate: today,
          note: note.trim() || undefined,
          recentLifts,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Could not consult. Pick from the list.';
        setError(message);
        return;
      }
      const parsed = gymConsultSchema.safeParse(
        body && typeof body === 'object' && 'consult' in body ? body.consult : body,
      );
      if (!parsed.success) {
        setError('Could not consult. Pick from the list.');
        return;
      }
      const bound = bindConsultToCatalog(parsed.data);
      if (bound.picks.length < 3) {
        setError('Consult came back thin. Pick from the list.');
        return;
      }
      setConsult(bound);

    } catch {
      setError('Could not consult. Pick from the list.');
    } finally {
      setBusy(false);
    }
  }

  async function acceptConsult() {
    if (!consult || busy) return;
    setBusy(true);
    setError(null);
    try {
      const bound = consult;
      const present = new Set(items.map((row) => row.slug));
      for (const pick of bound.picks) {
        if (present.has(pick.exercise.slug) || avoid.includes(pick.exercise.slug)) continue;
        present.add(pick.exercise.slug);
        await addGymSessionItem({
          userId,
          sessionId,
          slug: pick.exercise.slug,
          exerciseName: pick.exercise.name,
          source: 'ai',
          targetSets: pick.sets,
          targetReps: pick.reps,
          targetWeightKg: lastLoadKg(historySets, pick.exercise.name)
            ? Number(lastLoadKg(historySets, pick.exercise.name))
            : null,
        });
      }

      setConsult(null);
      await load();
    } catch {
      setError('Could not add all proposed lifts. Retry to add the remaining lifts.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function completePlanned(item: LocalGymSessionItem, planned: LocalGymPlannedSet) {
    if (!active) {
      setError('Start the session before checking a set.');
      return;
    }
    const draft = actuals[planned.id] ?? {
      kg: planned.target_weight_kg !== null ? String(planned.target_weight_kg) : '0',
      reps: String(planned.target_reps),
      rir: planned.target_rir !== null ? String(planned.target_rir) : '',
    };
    const kg = Number(draft.kg);
    const count = Number(draft.reps);
    const rir = draft.rir === '' ? null : Number(draft.rir);
    if (!Number.isFinite(kg) || kg < 0 || !Number.isFinite(count) || count < 0) {
      setError('Use a real weight and rep count.');
      return;
    }
    const exerciseId = catalogExerciseId(item.slug);
    const performed = await completeLocalWorkoutSet({
      userId,
      workoutId: active.id,
      exerciseId,
      exerciseName: item.exercise_name,
      exerciseOrder: item.sequence_index,
      setIndex: nextSetIndex(sets, exerciseId),
      weightKg: kg,
      reps: count,
      rir: Number.isFinite(rir) ? rir : null,
      setType: planned.set_type,
      restSeconds: planned.rest_seconds,
    });
    await updateGymPlannedSet({
      id: planned.id,
      userId,
      performed_set_id: performed.id,
    });
    await refreshGymItemState({ userId, itemId: item.id });
    if (planned.rest_seconds && planned.rest_seconds > 0) {
      await startLocalRestTimer({
        workoutId: active.id,
        userId,
        seconds: planned.rest_seconds,
        performedSetId: performed.id,
      });
    }
    setUndoId(performed.id);
    await load();
    await session.refresh();
  }

  async function onUndo(performedId = undoId) {
    if (!performedId) return;
    const removed = await tombstoneLocalWorkoutSet({ id: performedId, userId });
    for (const planned of plannedByItem.values()) {
      const hit = planned.find((row) => row.performed_set_id === performedId);
      if (hit) {
        await updateGymPlannedSet({ id: hit.id, userId, performed_set_id: null });
        await refreshGymItemState({ userId, itemId: hit.item_id });
      }
    }
    if (active && session.timer?.performed_set_id === performedId) {
      await clearLocalRestTimer(active.id);
    }
    if (undoId === performedId) setUndoId(null);
    if (removed) {
      await load();
      await session.refresh();
    }
  }

  function displayedElapsedSeconds(): number {
    if (!active) return 0;
    const raw = sessionElapsedSeconds(active.started_at, session.nowMs);
    const frozen = pauseStartedMs !== null ? (session.nowMs - pauseStartedMs) / 1000 : 0;
    return Math.max(0, Math.floor(raw - pauseOffsetSec - frozen));
  }

  function onGymToggle() {
    if (!active) {
      void onStart();
      return;
    }
    if (sessionPaused) {
      if (pauseStartedMs !== null) {
        setPauseOffsetSec((n) => n + (Date.now() - pauseStartedMs) / 1000);
      }
      setPauseStartedMs(null);
      setSessionPaused(false);
      return;
    }
    setPauseStartedMs(Date.now());
    setSessionPaused(true);
  }

  const visibleItems = items.filter((row) => row.state !== 'SKIPPED' && row.state !== 'SUBSTITUTED');
  const totalSets = [...plannedByItem.values()].reduce((n, rows) => n + rows.length, 0);
  const doneSets = [...plannedByItem.values()].reduce((n, rows) => n + setsDone(rows), 0);
  const busyUnfinished = visibleItems.filter((item) => {
    const planned = plannedByItem.get(item.id) ?? [];
    return liftNeedsBusyStation(item.slug, busyGear) && setsDone(planned) < Math.max(planned.length, 1);
  });
  const restFrom =
    sets.find((row) => row.id === session.timer?.performed_set_id)?.exercise_name_snapshot ?? 'set';
  const elapsedClock = formatRestClock(displayedElapsedSeconds());
  const gymRunning = Boolean(active) && !sessionPaused;
  const picker = searchCatalog({ query: pickerQuery })
    .filter((row) => !items.some((item) => item.slug === row.slug))
    .slice(0, 6);
  const splitLabel = consult?.splitLabel ?? (visibleItems.length > 0 ? 'frame' : 'empty frame');

  return (
    <section className={styles.deskScreen} aria-labelledby="gym-title" data-gym="">
      <header className={styles.deskHead}>
        <div>
          <p className={styles.eyebrow}>
            Training · {splitLabel} · {active ? `started ${formatTime(active.started_at, clock.timeZone)}` : 'main gym'}
          </p>
          <h1 id="gym-title" className={styles.title}>
            Gym
          </h1>
        </div>
        <p className={styles.deskHeadLede}>
          Build the frame, lock what must stay, let Mus fill the gaps. Planned targets survive a
          lighter set.
        </p>
      </header>

      <section className={styles.sessionBar}>
        <button
          type="button"
          className={styles.sessionToggle}
          data-running={gymRunning ? 'true' : undefined}
          disabled={busy}
          onClick={() => onGymToggle()}
        >
          {!active ? 'Start session' : sessionPaused ? 'Resume session' : 'Pause session'}
        </button>
        <div className={styles.sessionClock}>
          <span className={styles.sessionClockNum}>{elapsedClock}</span>
          <span className={styles.sessionClockUnit}>elapsed</span>
        </div>
        <p className={styles.sessionNote}>
          {totalSets === 0
            ? items.length > 0
              ? `${items.length} lifts in the frame · start when the must-dos are locked`
              : 'Add must-do lifts, then start. An interrupted session resumes from this screen.'
            : `${doneSets} of ${totalSets} sets logged · targets stay as planned even when a set comes in light`}
        </p>
        <div className={styles.sessionPills}>
          <button type="button" className={styles.pill} disabled={busy || Boolean(active)} onClick={() => void onCopyLast()}>
            Copy last workout
          </button>
          {active ? (
            <button type="button" className={styles.pill} disabled={busy} onClick={() => void onFinish()}>
              Finish
            </button>
          ) : (
            <button type="button" className={styles.pill} disabled={busy} onClick={() => void onConsult()}>
              Ask Mus to fill gaps
            </button>
          )}
        </div>
      </section>

      <GymRestBar variant="page" restFrom={restFrom} />

      <section className={styles.busyRow} aria-label="Busy today">
        <span className={styles.busyLabel}>Busy today</span>
        {BUSY_GEAR.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.busyChip}
            data-on={busyGear.includes(item.id) ? 'true' : 'false'}
            onClick={() => {
              void toggleGymBusyEquipment({
                userId,
                logicalDate: today,
                equipmentId: item.id,
              }).then(() => load());
            }}
          >
            {item.label}
          </button>
        ))}
        <span className={styles.busyOverlap}>
          {busyUnfinished.length === 0
            ? 'Nothing you still owe needs a busy station.'
            : `${busyUnfinished.length} unfinished ${busyUnfinished.length === 1 ? 'lift needs' : 'lifts need'} a station you marked busy — swaps offered below.`}
        </span>
      </section>

      <label className={styles.sessionNoteField}>
        <span className={styles.busyLabel}>Session note</span>
        <input
          className={styles.captureInput}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Push, short session, shoulder discomfort…"
          autoComplete="off"
        />
      </label>

      {consult ? (
        <div className={styles.consultCard}>
          <p className={styles.statLabel}>{consult.splitLabel}</p>
          <p className={styles.statNote}>{consult.rationale}</p>
          <ul>{consult.picks.map((pick) => <li key={pick.exercise.slug}>{pick.exercise.name} · {pick.sets} × {pick.reps}</li>)}</ul>
          <p>Proposal only. Nothing is added until you confirm.</p>
          <button type="button" disabled={busy} onClick={() => void acceptConsult()}>Add proposed lifts</button>
          <button type="button" disabled={busy} onClick={() => setConsult(null)}>Dismiss proposal</button>
        </div>
      ) : null}

      {overlap.length > 0 ? (
        <p className={styles.note}>{overlap.join(' ')}</p>
      ) : null}

      {error ? (
        <p className={styles.note} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.liftCard}>
        <div className={styles.liftHead}>
          <span />
          <span>Lift · source</span>
          <span>Sets</span>
          <span>Planned</span>
          <span>Last time</span>
          <span />
        </div>
        {visibleItems.length === 0 ? (
          <p className={styles.bucketEmpty}>Pick lifts below. Lock the ones AI must not replace.</p>
        ) : (
          visibleItems.map((item) => {
            const planned = plannedByItem.get(item.id) ?? [];
            const done = setsDone(planned);
            const complete = planned.length > 0 && done === planned.length;
            const last = lastSessionSets(
              historySets.filter((row) => row.workout_id !== active?.id),
              item.exercise_name,
            );
            const catalog = exerciseBySlug(item.slug);
            const stationBusy = liftNeedsBusyStation(item.slug, busyGear) && !complete;
            const swaps = listedSubstitutes(item.slug, 6).filter((row) => {
              if (busyGear.length === 0) return true;
              return !row.exercise.requiredEquipment.some((id) => busyGear.includes(id));
            });
            const open = openId === item.id;
            const first = planned[0];
            const plan =
              planned.length === 0
                ? '—'
                : `${planned.length} × ${first?.target_reps ?? '—'} @ ${first?.target_weight_kg ?? '—'}`;
            const lastLabel =
              last.length === 0 ? 'first time' : `${last.length} × ${last[0]?.reps ?? '—'} @ ${last[0]?.weightKg ?? '—'}`;
            return (
              <div key={item.id} className={styles.liftBody} data-open={open ? 'true' : undefined}>
                <button
                  type="button"
                  className={styles.liftRow}
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                >
                  <span
                    className={styles.liftMark}
                    data-done={complete ? 'true' : undefined}
                    data-busy={stationBusy ? 'true' : undefined}
                  >
                    {complete ? '✓' : stationBusy ? '!' : '·'}
                  </span>
                  <span className={styles.liftNameBlock}>
                    <span className={styles.liftNameLine}>
                      <span className={styles.liftName}>{item.exercise_name}</span>
                      {item.locked ? <span className={styles.liftLock}>◆</span> : null}
                      <span className={styles.liftSource}>{sourceTag(item.source)}</span>
                    </span>
                    <span className={styles.liftMeta}>
                      {catalog
                        ? `${catalog.movementPattern.replaceAll('_', ' ')} · ${catalog.primaryMuscle}`
                        : item.state.toLowerCase()}
                    </span>
                  </span>
                  <span className={styles.liftSets} data-done={complete ? 'true' : undefined}>
                    {done}/{planned.length || item.target_sets}
                  </span>
                  <span className={styles.liftPlan}>{plan}</span>
                  <span className={styles.liftLast}>{lastLabel}</span>
                  <span className={styles.liftChevron}>{open ? '▾' : '▸'}</span>
                </button>
                {open ? (
                  <div className={styles.liftOpen}>
                    <div className={styles.setTable}>
                      <div className={styles.setHead}>
                        <span>Set</span>
                        <span>Planned</span>
                        <span>Actual · RIR</span>
                        <span>Last</span>
                        <span />
                      </div>
                      {planned.map((row, index) => {
                        const draft = actuals[row.id] ?? {
                          kg: row.target_weight_kg !== null ? String(row.target_weight_kg) : '0',
                          reps: String(row.target_reps),
                          rir: row.target_rir !== null ? String(row.target_rir) : '',
                        };
                        const prior = last[index];
                        const saved = Boolean(row.performed_set_id);
                        const performed = sets.find((set) => set.id === row.performed_set_id);
                        return (
                          <div key={row.id} className={styles.setRow}>
                            <span className={styles.setLabel}>
                              {row.set_type === 'warmup' ? 'WU ' : 'Set '}
                              {index + 1}
                            </span>
                            <span className={styles.setPlan}>
                              {row.target_weight_kg ?? '—'} × {row.target_reps}
                            </span>
                            <span className={styles.setActual}>
                              {saved ? (
                                <span className={styles.setSaved}>
                                  <span className={styles.setSavedNum}>
                                    {performed ? `${performed.weight_kg} × ${performed.reps}` : 'Loading recorded set…'}
                                  </span>
                                  {performed?.rir != null ? <span className={styles.setSavedRir}>RIR {performed.rir}</span> : null}
                                </span>
                              ) : (
                                <span className={styles.setDraft}>
                                  <input
                                    className={styles.setNum}
                                    aria-label={`Weight in kg for ${item.exercise_name} set ${index + 1}`}
                                    value={draft.kg}
                                    onChange={(event) =>
                                      setActuals((current) => ({
                                        ...current,
                                        [row.id]: { ...draft, kg: event.target.value },
                                      }))
                                    }
                                    inputMode="decimal"
                                  />
                                  <span className={styles.setMul}>×</span>
                                  <input
                                    className={styles.setNum}
                                    data-reps=""
                                    aria-label={`Reps for ${item.exercise_name} set ${index + 1}`}
                                    value={draft.reps}
                                    onChange={(event) =>
                                      setActuals((current) => ({
                                        ...current,
                                        [row.id]: { ...draft, reps: event.target.value },
                                      }))
                                    }
                                    inputMode="numeric"
                                  />
                                  <input
                                    className={styles.setRir}
                                    aria-label={`Reps in reserve for ${item.exercise_name} set ${index + 1}`}
                                    placeholder="RIR"
                                    value={draft.rir}
                                    onChange={(event) =>
                                      setActuals((current) => ({
                                        ...current,
                                        [row.id]: { ...draft, rir: event.target.value },
                                      }))
                                    }
                                    inputMode="numeric"
                                  />
                                </span>
                              )}
                            </span>
                            <span className={styles.setPrior}>
                              {prior ? `${prior.weightKg} × ${prior.reps}` : '—'}
                            </span>
                            <span className={styles.setActs}>
                              {saved && row.performed_set_id ? (
                                <>
                                  <span className={styles.savedTag}>saved</span>
                                  <button
                                    type="button"
                                    className={styles.ghostMini}
                                    onClick={() => void onUndo(row.performed_set_id ?? undefined)}
                                  >
                                    Undo
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className={styles.completeBtn}
                                    disabled={!active || busy}
                                    onClick={() => void completePlanned(item, row)}
                                  >
                                    Complete
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.ghostMini}
                                    onClick={() =>
                                      void removeFutureGymPlannedSet({ id: row.id, userId }).then(() => load())
                                    }
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className={styles.liftActions}>
                      <button
                        type="button"
                        className={styles.liftAction}
                        onClick={() =>
                          void updateGymSessionItem({
                            id: item.id,
                            userId,
                            locked: !item.locked,
                          }).then(() => load())
                        }
                      >
                        {item.locked ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        type="button"
                        className={styles.liftAction}
                        onClick={() => void duplicateGymSessionItem({ userId, itemId: item.id }).then(() => load())}
                      >
                        Repeat lift
                      </button>
                      <button
                        type="button"
                        className={styles.liftAction}
                        onClick={() =>
                          void reorderGymSessionItem({ id: item.id, userId, direction: 'up' }).then(() => load())
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className={styles.liftAction}
                        onClick={() =>
                          void reorderGymSessionItem({ id: item.id, userId, direction: 'down' }).then(() => load())
                        }
                      >
                        Down
                      </button>
                      {active ? (
                        <button
                          type="button"
                          className={styles.liftAction}
                          onClick={() =>
                            void updateGymSessionItem({ id: item.id, userId, state: 'SKIPPED' }).then(() => load())
                          }
                        >
                          Skip
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.liftAction}
                        onClick={() =>
                          void saveLocalGymPrefs({
                            userId,
                            favorite_slugs: favorites.includes(item.slug)
                              ? favorites.filter((slug) => slug !== item.slug)
                              : [...favorites, item.slug],
                          }).then(() => load())
                        }
                      >
                        {favorites.includes(item.slug) ? 'Unfavorite' : 'Favorite'}
                      </button>
                      <button
                        type="button"
                        className={styles.liftAction}
                        onClick={() =>
                          void saveLocalGymPrefs({
                            userId,
                            avoid_slugs: avoid.includes(item.slug)
                              ? avoid.filter((slug) => slug !== item.slug)
                              : [...avoid, item.slug],
                          }).then(() => load())
                        }
                      >
                        {avoid.includes(item.slug) ? 'Allow again' : 'Prefer not'}
                      </button>
                      <button
                        type="button"
                        className={styles.liftAction}
                        onClick={() =>
                          void updateGymSessionItem({
                            id: item.id,
                            userId,
                            discomfort: !item.discomfort,
                          }).then(() => load())
                        }
                      >
                        {item.discomfort ? 'Discomfort flagged' : 'Flag discomfort'}
                      </button>
                      <button
                        type="button"
                        className={styles.liftAction}
                        onClick={() => void addGymPlannedSet({ userId, itemId: item.id }).then(() => load())}
                      >
                        Add set
                      </button>
                    </div>
                    {item.discomfort ? (
                      <p className={styles.note}>
                        Discomfort flagged. Pick a substitute from the catalog — this is not a diagnosis.
                      </p>
                    ) : null}
                    {stationBusy && swaps.length > 0 ? (
                      <div className={styles.swapBanner}>
                        <span className={styles.swapLabel}>Station taken</span>
                        {swaps.map((row) => (
                          <button
                            key={row.exercise.slug}
                            type="button"
                            className={styles.swapPill}
                            onClick={() =>
                              void substituteGymSessionItem({
                                userId,
                                itemId: item.id,
                                slug: row.exercise.slug,
                                exerciseName: row.exercise.name,
                              }).then(() => load())
                            }
                          >
                            {row.exercise.name}
                          </button>
                        ))}
                        <span className={styles.swapHint}>
                          Same pattern, same primary muscle. Completed sets stay on the original.
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        <div className={styles.catalogStrip}>
          <span className={styles.busyLabel}>Add from catalog</span>
          <input
            className={styles.catalogSearch}
            value={pickerQuery}
            onChange={(event) => setPickerQuery(event.target.value)}
            placeholder="Search lifts…"
            aria-label="Search lifts"
            autoComplete="off"
          />
          {picker.map((row) => (
            <button
              key={row.slug}
              type="button"
              className={styles.swapPill}
              onClick={() => void addLift(row)}
            >
              {row.name}
            </button>
          ))}
          <span className={styles.catalogNote}>
            {picker.length} in view · pick a row, then log
          </span>
        </div>
      </section>

      <DeskMusPane
        userId={userId}
        logicalDate={today}
        module="gym"
        view={active ? 'session' : 'frame'}
        selectedIds={openId ? [openId] : []}
        selectionLabel={
          openId ? (items.find((row) => row.id === openId)?.exercise_name ?? undefined) : undefined
        }
      />
    </section>
  );
}
