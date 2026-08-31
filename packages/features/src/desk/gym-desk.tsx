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
  getLocalRestTimer,
  gymDraftSessionId,
  listGymBusyEquipment,
  listGymPlannedSets,
  listGymSessionItems,
  listLocalWorkoutHistory,
  listLocalWorkoutSets,
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
  type LocalRestTimer,
  type LocalWorkout,
  type LocalWorkoutSet,
} from '@kayamo/offline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import { bindConsultToCatalog, type BoundConsult } from '../gym/consult';
import { gymConsultSchema } from '../gym/consult-schema';
import { catalogExerciseId, exerciseBySlug, GYM_CATALOG, listedSubstitutes, type CatalogExercise } from '../gym/library';
import { lastLoadKg, lastSessionSets } from '../gym/last-load';
import { familyOverlapWarnings } from '../gym/redundancy';
import styles from '../food/desk.module.css';
import { DeskMusPane } from './desk-mus';
import { GymPicker } from './gym-picker';
import { GymRestOverlay } from './gym-rest';
import { useDeskClock } from './use-desk-clock';

const BUSY_GEAR = [
  { id: 'cable', label: 'Cable busy' },
  { id: 'machine', label: 'Machine busy' },
  { id: 'smith_machine', label: 'Smith busy' },
  { id: 'hack_squat', label: 'Hack squat down' },
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

function elapsedLabel(startedAt: string, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - Date.parse(startedAt)) / 60_000));
  return `${minutes} min elapsed`;
}

function nextSetIndex(sets: LocalWorkoutSet[], exerciseId: string): number {
  return sets
    .filter((row) => row.exercise_id === exerciseId)
    .reduce((max, row) => Math.max(max, row.set_index + 1), 0);
}

function setsDone(planned: LocalGymPlannedSet[]): number {
  return planned.filter((row) => row.performed_set_id).length;
}

export function GymDesk({ userId }: { userId: string }) {
  const { clock, today } = useDeskClock(userId);
  const draftId = gymDraftSessionId(userId);
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [sets, setSets] = useState<LocalWorkoutSet[]>([]);
  const [historySets, setHistorySets] = useState<LocalWorkoutSet[]>([]);
  const [items, setItems] = useState<LocalGymSessionItem[]>([]);
  const [plannedByItem, setPlannedByItem] = useState<Map<string, LocalGymPlannedSet[]>>(new Map());
  const [timer, setTimer] = useState<LocalRestTimer | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [actuals, setActuals] = useState<Record<string, { kg: string; reps: string; rir: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [consult, setConsult] = useState<BoundConsult | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [busyGear, setBusyGear] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [avoid, setAvoid] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  const active = workouts.find((row) => row.status === 'active') ?? null;
  const sessionId = active?.id ?? draftId;

  const load = useCallback(async () => {
    const history = await listLocalWorkoutHistory(userId);
    const todayRows = history.filter((row) => row.logical_date === today);
    setWorkouts(todayRows);
    const recent = history.slice(0, 12);
    const nested = await Promise.all(recent.map((row) => listLocalWorkoutSets(row.id)));
    setHistorySets(nested.flat());
    const live = todayRows.find((row) => row.status === 'active') ?? null;
    const sid = live?.id ?? draftId;
    if (live) {
      setSets(await listLocalWorkoutSets(live.id));
      setTimer((await getLocalRestTimer(live.id)) ?? null);
    } else {
      setSets([]);
      setTimer(null);
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
  }, [draftId, today, userId]);

  useEffect(() => {
    void load();
    const timerId = window.setInterval(() => void load(), 4000);
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearInterval(timerId);
      window.clearInterval(tick);
    };
  }, [load]);

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
    } catch {
      setError('Could not finish that session.');
    } finally {
      setBusy(false);
    }
  }

  async function onCopyLast() {
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
      await load();
    } catch {
      setError('Could not consult. Pick from the list.');
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
  }

  async function onUndo() {
    if (!undoId) return;
    const removed = await tombstoneLocalWorkoutSet({ id: undoId, userId });
    for (const planned of plannedByItem.values()) {
      const hit = planned.find((row) => row.performed_set_id === undoId);
      if (hit) {
        await updateGymPlannedSet({ id: hit.id, userId, performed_set_id: null });
        await refreshGymItemState({ userId, itemId: hit.item_id });
      }
    }
    if (active && timer?.performed_set_id === undoId) {
      await clearLocalRestTimer(active.id);
    }
    setUndoId(null);
    if (removed) await load();
  }

  return (
    <section className={styles.panel} aria-labelledby="gym-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Training</p>
          <h1 id="gym-title" className={styles.title}>
            Gym
          </h1>
          <p className={styles.lede}>
            Build a frame, lock what must stay, fill the gaps, then run it as a to-do queue.
            Planned targets stay even when the set comes in lighter. Consult only picks catalog
            slugs.
          </p>
        </div>
      </header>

      <div className={styles.dashSplit}>
        <div className={styles.dashMain}>
      <div className={styles.formRow}>
        {active ? (
          <button type="button" className={styles.primary} disabled={busy} onClick={() => void onFinish()}>
            Finish session
          </button>
        ) : (
          <button type="button" className={styles.primary} disabled={busy} onClick={() => void onStart()}>
            Start workout
          </button>
        )}
        {!active ? (
          <button type="button" className={styles.ghost} disabled={busy} onClick={() => void onCopyLast()}>
            Copy last workout
          </button>
        ) : null}
        <p className={styles.statNote}>
          {active
            ? `${elapsedLabel(active.started_at, nowMs)} · started ${formatTime(active.started_at, clock.timeZone)}`
            : items.length > 0
              ? `${items.length} lifts in the frame`
              : 'Add must-do lifts, then start. An interrupted session resumes from this screen.'}
        </p>
      </div>

      {timer && active ? <GymRestOverlay timer={timer} onChange={load} /> : null}

      <div className={styles.consultBar}>
        <label className={styles.grow}>
          Session note
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Push, short session, shoulder discomfort…"
            autoComplete="off"
          />
        </label>
        <button type="button" className={styles.ghost} disabled={busy} onClick={() => void onConsult()}>
          AI fill gaps
        </button>
      </div>

      <div className={styles.chipRow} role="group" aria-label="Busy today">
        {BUSY_GEAR.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.chip}
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
      </div>

      {consult ? (
        <div className={styles.consultCard}>
          <p className={styles.statLabel}>{consult.splitLabel}</p>
          <p className={styles.statNote}>{consult.rationale}</p>
        </div>
      ) : null}

      {overlap.length > 0 ? (
        <p className={styles.note}>{overlap.join(' ')}</p>
      ) : null}

      {items.length === 0 ? (
        <p className={styles.empty}>Pick lifts below. Lock the ones AI must not replace.</p>
      ) : (
        <ol className={styles.queueList}>
          {items.map((item) => {
            const planned = plannedByItem.get(item.id) ?? [];
            const done = setsDone(planned);
            const last = lastSessionSets(
              historySets.filter((row) => row.workout_id !== active?.id),
              item.exercise_name,
            );
            const catalog = exerciseBySlug(item.slug);
            const swaps = listedSubstitutes(item.slug, 6).filter((row) => {
              if (busyGear.length === 0) return true;
              return !row.exercise.requiredEquipment.some((id) => busyGear.includes(id));
            });
            const open = openId === item.id;
            return (
              <li key={item.id} className={styles.queueCard} data-state={item.state}>
                <div className={styles.queueHead}>
                  <button
                    type="button"
                    className={styles.textAction}
                    onClick={() => setOpenId(open ? null : item.id)}
                  >
                    {item.state === 'COMPLETED' ? '☑' : item.state === 'PARTIAL' || item.state === 'ADDED_LIVE' ? '◉' : '☐'}{' '}
                    {item.locked ? '🔒 ' : ''}
                    {item.exercise_name}
                  </button>
                  <span className={styles.aliases}>
                    {done}/{planned.length}
                    {item.state !== 'QUEUED' ? ` · ${item.state.toLowerCase()}` : ''}
                  </span>
                </div>
                <div className={styles.taskActions}>
                  <button
                    type="button"
                    className={styles.ghost}
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
                    className={styles.ghost}
                    onClick={() => void duplicateGymSessionItem({ userId, itemId: item.id }).then(() => load())}
                  >
                    Repeat lift
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => void reorderGymSessionItem({ id: item.id, userId, direction: 'up' }).then(() => load())}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() =>
                      void reorderGymSessionItem({ id: item.id, userId, direction: 'down' }).then(() => load())
                    }
                  >
                    Down
                  </button>
                  {active ? (
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() =>
                        void updateGymSessionItem({ id: item.id, userId, state: 'SKIPPED' }).then(() => load())
                      }
                    >
                      Skip
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.ghost}
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
                    className={styles.ghost}
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
                    className={styles.ghost}
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
                </div>
                {item.discomfort ? (
                  <p className={styles.note}>
                    Discomfort flagged. Pick a substitute from the catalog — this is not a diagnosis.
                  </p>
                ) : null}
                {swaps.length > 0 ? (
                  <p className={styles.statNote}>
                    Station taken:{' '}
                    {swaps.map((row, index) => (
                      <span key={row.exercise.slug}>
                        {index > 0 ? ' · ' : null}
                        <button
                          type="button"
                          className={styles.textAction}
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
                      </span>
                    ))}
                  </p>
                ) : null}
                {open ? (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">Set</th>
                          <th scope="col">Plan</th>
                          <th scope="col">Today</th>
                          <th scope="col">Last</th>
                          <th scope="col"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {planned.map((row, index) => {
                          const draft = actuals[row.id] ?? {
                            kg: row.target_weight_kg !== null ? String(row.target_weight_kg) : '0',
                            reps: String(row.target_reps),
                            rir: row.target_rir !== null ? String(row.target_rir) : '',
                          };
                          const prior = last[index];
                          return (
                            <tr key={row.id}>
                              <th scope="row">
                                {row.set_type === 'warmup' ? 'WU ' : ''}
                                {index + 1}
                              </th>
                              <td>
                                {row.target_weight_kg ?? '—'} × {row.target_reps}
                                {row.rest_seconds ? ` · rest ${row.rest_seconds}s` : ''}
                              </td>
                              <td>
                                {row.performed_set_id ? (
                                  'saved'
                                ) : (
                                  <span className={styles.setInputs}>
                                    <input
                                      aria-label={`Today kg for ${item.exercise_name} set ${index + 1}`}
                                      value={draft.kg}
                                      onChange={(event) =>
                                        setActuals((current) => ({
                                          ...current,
                                          [row.id]: { ...draft, kg: event.target.value },
                                        }))
                                      }
                                      inputMode="decimal"
                                    />
                                    ×
                                    <input
                                      aria-label={`Today reps for ${item.exercise_name} set ${index + 1}`}
                                      value={draft.reps}
                                      onChange={(event) =>
                                        setActuals((current) => ({
                                          ...current,
                                          [row.id]: { ...draft, reps: event.target.value },
                                        }))
                                      }
                                      inputMode="numeric"
                                    />
                                  </span>
                                )}
                              </td>
                              <td>{prior ? `${prior.weightKg} × ${prior.reps}` : '—'}</td>
                              <td>
                                {row.performed_set_id ? (
                                  '✓'
                                ) : (
                                  <button
                                    type="button"
                                    className={styles.ghost}
                                    disabled={!active || busy}
                                    onClick={() => void completePlanned(item, row)}
                                  >
                                    Complete set
                                  </button>
                                )}
                                {!row.performed_set_id ? (
                                  <button
                                    type="button"
                                    className={styles.ghost}
                                    onClick={() =>
                                      void removeFutureGymPlannedSet({ id: row.id, userId }).then(() => load())
                                    }
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => void addGymPlannedSet({ userId, itemId: item.id }).then(() => load())}
                    >
                      Add set
                    </button>
                    {catalog ? (
                      <p className={styles.aliases}>
                        {catalog.movementPattern.replaceAll('_', ' ')} · {catalog.primaryMuscle} ·{' '}
                        {catalog.trackingMode.replaceAll('_', ' ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <GymPicker selectedSlug={openId ? items.find((row) => row.id === openId)?.slug ?? null : null} onSelect={(exercise) => void addLift(exercise)} />

      {undoId ? (
        <p className={styles.note}>
          Last set saved.{' '}
          <button type="button" className={styles.textAction} onClick={() => void onUndo()}>
            Undo
          </button>
        </p>
      ) : null}

      {error ? (
        <p className={styles.note} role="alert">
          {error}
        </p>
      ) : null}

      {workouts.filter((row) => row.status === 'completed').length > 0 ? (
        <p className={styles.note}>
          {workouts.filter((row) => row.status === 'completed').length} finished today
        </p>
      ) : null}
        </div>
        <DeskMusPane
          userId={userId}
          logicalDate={today}
          module="gym"
          view={active ? 'session' : 'frame'}
          selectedIds={openId ? [openId] : []}
        />
      </div>
    </section>
  );
}
