'use client';

import {
  createBrowserSupabase,
  listEffectiveNutritionTargets,
  type NutritionTarget,
} from '@kayamo/db';
import {
  asMealSlot,
  mealSlotLabel,
  rescaleNutrientSnapshot,
} from '@kayamo/food/quick-log';
import {
  logicalDateFromInstant,
  restoreLocalFoodEntry,
  reviseLocalFoodEntry,
  tombstoneLocalFoodEntry,
  useLiveFoodEntries,
  useLiveFoodHistory,
  type LocalFoodEntry,
} from '@kayamo/offline';
import { Toast } from '@kayamo/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProvenanceKcal } from './provenance';
import { hydrateFoodHistory } from './hydrate-food-history';
import { pickHeadlineTarget, weekHeadline, weekKcalBars } from './week-headline';
import { DeskBarChart } from '../desk/desk-charts';
import { DeskMusPane } from '../desk/desk-mus';
import styles from './desk.module.css';

const UNDO_MS = 8000;

function formatTime(loggedAt: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(loggedAt));
  } catch {
    return loggedAt.slice(11, 16);
  }
}

export function TodayTable({ userId }: { userId: string }) {
  const [clock, setClock] = useState({ timeZone: 'Asia/Manila', dayStartsAt: '00:00:00' });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [targets, setTargets] = useState<NutritionTarget[]>([]);
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);

  const today = logicalDateFromInstant(new Date(nowMs).toISOString(), clock.timeZone, clock.dayStartsAt);
  const entries = useLiveFoodEntries(userId, today);
  const history = useLiveFoodHistory(userId);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    void (async () => {
      try {
        const next = await hydrateFoodHistory({ client, userId });
        if (!cancelled) setClock(next);
      } catch {
        // Default clock.
      }
    })();
    const tick = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [userId]);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listEffectiveNutritionTargets(client, { userId, date: today });
        if (!cancelled) setTargets(rows);
      } catch {
        if (!cancelled) setTargets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today, userId]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const headline = useMemo(
    () =>
      weekHeadline({
        today,
        entries: history,
        target: pickHeadlineTarget(targets),
      }),
    [history, targets, today],
  );

  async function commitQuantity(row: LocalFoodEntry, raw: string) {
    const quantity = Number(raw);
    const oldQty = Number(row.quantity) || 1;
    const oldGrams = Number(row.grams) || 0;
    if (!Number.isFinite(quantity) || quantity <= 0 || oldGrams <= 0) return;
    const grams = (oldGrams / oldQty) * quantity;
    const nutrients = rescaleNutrientSnapshot(row, oldGrams, grams);
    setError(null);
    const next = await reviseLocalFoodEntry({
      id: row.id,
      userId,
      quantity: String(quantity),
      grams: String(grams),
      ...nutrients,
    });
    if (!next) setError('Could not update that entry.');
  }

  async function onDelete(row: LocalFoodEntry) {
    setError(null);
    await tombstoneLocalFoodEntry({ id: row.id, userId });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id: row.id, name: row.food_name_snapshot });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function onUndo() {
    if (!undo) return;
    const id = undo.id;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const restored = await restoreLocalFoodEntry({ id, userId });
    if (!restored) setError('Could not restore that entry.');
  }

  const remainingCopy =
    headline.targetKcal === null
      ? 'No target yet'
      : headline.over
        ? `${Math.abs(headline.remainingKcal ?? 0).toLocaleString('en-PH')} over · from this week's target`
        : `${(headline.remainingKcal ?? 0).toLocaleString('en-PH')} left · from this week's target`;
  const kcalBars = useMemo(() => weekKcalBars(today, history), [history, today]);

  return (
    <section className={styles.panel} aria-labelledby="today-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Diary</p>
          <h1 id="today-title" className={styles.title}>
            Today
          </h1>
          <p className={styles.lede}>
            {today}. Log with <span className={styles.k}>⌘K</span>. Totals follow your day
            boundary, not midnight.
          </p>
        </div>
      </header>

      <div className={styles.dashSplit}>
        <div className={styles.dashMain}>
      <div className={styles.headline}>
        <div>
          <p className={styles.statLabel}>This week's average</p>
          <p className={styles.statValue}>
            {headline.weekAverageKcal === null
              ? '—'
              : headline.weekAverageKcal.toLocaleString('en-PH')}
          </p>
          <p className={styles.statNote}>
            {headline.daysLogged === 0
              ? 'No days logged this week yet'
              : `${headline.daysLogged} day${headline.daysLogged === 1 ? '' : 's'} logged · from your entries`}
          </p>
        </div>
        <div>
          <p className={styles.statLabel}>Today remaining</p>
          <p className={styles.statValue}>
            {headline.targetKcal === null
              ? '—'
              : Math.abs(headline.remainingKcal ?? 0).toLocaleString('en-PH')}
          </p>
          <p className={styles.statNote}>{remainingCopy}</p>
        </div>
      </div>

      <div className={styles.chartRow}>
        <DeskBarChart caption="kcal this week" bars={kcalBars} unit="kcal" />
      </div>

      {entries.length === 0 ? (
        <p className={styles.empty}>Nothing on this logical date yet. ⌘K to log.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Meal</th>
                <th scope="col">Food</th>
                <th scope="col">Qty</th>
                <th scope="col">kcal</th>
                <th scope="col">
                  <span className={styles.srOnly}>Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => {
                const slot = asMealSlot(row.meal_slot);
                return (
                  <tr key={row.id}>
                    <th scope="row">{formatTime(row.logged_at, clock.timeZone)}</th>
                    <td>{slot ? mealSlotLabel(slot, 'taglish') : row.meal_slot}</td>
                    <td className={styles.wrap}>
                      {row.food_name_snapshot}
                      {row.serving_label_snapshot ? (
                        <div className={styles.aliases}>{row.serving_label_snapshot}</div>
                      ) : null}
                    </td>
                    <td>
                      <input
                        key={`${row.id}:${row.updated_at}`}
                        className={styles.qty}
                        defaultValue={row.quantity}
                        inputMode="decimal"
                        aria-label={`Quantity for ${row.food_name_snapshot}`}
                        onBlur={(event) => void commitQuantity(row, event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    </td>
                    <td>
                      <ProvenanceKcal
                        kcal={row.kcal}
                        source={row.source}
                        verified={Number(row.confidence) >= 1}
                        estimate={row.source === 'llm'}
                        servingLabel={row.serving_label_snapshot}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => void onDelete(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error ? (
        <p className={styles.note} role="alert">
          {error}
        </p>
      ) : null}

      {undo ? (
        <div className={styles.toastDock}>
          <Toast
            message={`Removed ${undo.name}`}
            action={
              <button type="button" onClick={() => void onUndo()}>
                Undo
              </button>
            }
          />
        </div>
      ) : null}
        </div>
        <DeskMusPane userId={userId} logicalDate={today} module="calories" view="today" />
      </div>
    </section>
  );
}
