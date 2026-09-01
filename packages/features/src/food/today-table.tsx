'use client';

import {
  createBrowserSupabase,
  listEffectiveNutritionTargets,
  type NutritionTarget,
} from '@kayamo/db';
import { rescaleNutrientSnapshot, type MealSlot } from '@kayamo/food/quick-log';
import type { CatalogFood } from '@kayamo/food/search-ui';
import {
  listLocalWorkoutHistory,
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
import { catalogFromCache, hydrateVisibleCatalog } from './hydrate-catalog';
import { openLogPalette } from './command-log-model';
import { hydrateFoodHistory } from './hydrate-food-history';
import { isoWeekFromLogicalDate, mondayOfLogicalWeek, pickHeadlineTarget, weekHeadline } from './week-headline';
import {
  formatDiaryDate,
  formatWeekDelta,
  groupEntriesByMeal,
  presenceCells,
  presenceCopy,
  proteinNote,
  provenanceSummary,
  sessionNote,
  verifyQueueNote,
  weekAverageBar,
  weekStripDays,
} from './today-diary';
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

function markKind(row: Pick<LocalFoodEntry, 'source' | 'confidence'>): 'verified' | 'estimate' | 'plain' {
  if (row.source === 'llm') return 'estimate';
  if (Number(row.confidence) >= 1) return 'verified';
  return 'plain';
}

function diaryBadge(source: string): { label: string; kind: 'ph' | 'user' | 'plain' } | null {
  if (source === 'ph_core') return { label: 'PH', kind: 'ph' };
  if (source === 'off') return { label: 'Brand', kind: 'plain' };
  if (source === 'usda_fdc') return { label: 'USDA', kind: 'plain' };
  if (source === 'user') return { label: 'Yours', kind: 'user' };
  if (source === 'llm') return { label: 'Photo', kind: 'plain' };
  return null;
}

export function TodayTable({ userId }: { userId: string }) {
  const [clock, setClock] = useState({ timeZone: 'Asia/Manila', dayStartsAt: '00:00:00' });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [targets, setTargets] = useState<NutritionTarget[]>([]);
  const [catalog, setCatalog] = useState<CatalogFood[]>([]);
  const [viewDate, setViewDate] = useState<string | null>(null);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);

  const clockToday = logicalDateFromInstant(new Date(nowMs).toISOString(), clock.timeZone, clock.dayStartsAt);
  const today = viewDate ?? clockToday;
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
    void (async () => {
      try {
        const cached = await catalogFromCache();
        if (!cancelled && cached.length > 0) setCatalog(cached);
        await hydrateVisibleCatalog();
        const after = await catalogFromCache();
        if (!cancelled && after.length > 0) setCatalog(after);
      } catch {
        // Dexie cache is enough while offline.
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
    void listEffectiveNutritionTargets(client, { userId, date: today })
      .then((rows) => {
        if (!cancelled) setTargets(rows);
      })
      .catch(() => {
        if (!cancelled) setTargets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [today, userId]);

  useEffect(() => {
    let cancelled = false;
    void listLocalWorkoutHistory(userId)
      .then((rows) => {
        if (cancelled) return;
        const monday = mondayOfLogicalWeek(clockToday);
        const count = rows.filter(
          (row) =>
            row.status === 'completed' &&
            row.logical_date >= monday &&
            row.logical_date <= clockToday,
        ).length;
        setSessionsThisWeek(count);
      })
      .catch(() => {
        if (!cancelled) setSessionsThisWeek(0);
      });
    return () => {
      cancelled = true;
    };
  }, [clockToday, userId]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const target = useMemo(() => pickHeadlineTarget(targets), [targets]);
  const headline = useMemo(
    () => weekHeadline({ today: clockToday, entries: history, target }),
    [history, target, clockToday],
  );
  const strip = useMemo(
    () =>
      weekStripDays({
        today: clockToday,
        viewDate: today,
        entries: history,
        targetKcal: headline.targetKcal,
      }),
    [clockToday, headline.targetKcal, history, today],
  );
  const groups = useMemo(() => groupEntriesByMeal(entries), [entries]);
  const todayKcal = useMemo(
    () => Math.round(entries.reduce((sum, row) => sum + (Number(row.kcal) || 0), 0)),
    [entries],
  );
  const proteinG = useMemo(
    () => entries.reduce((sum, row) => sum + (Number(row.protein_g) || 0), 0),
    [entries],
  );
  const bar = weekAverageBar(headline.weekAverageKcal, headline.targetKcal);
  const delta = formatWeekDelta(headline.weekAverageKcal, headline.targetKcal);
  const weekOver =
    headline.weekAverageKcal !== null &&
    headline.targetKcal !== null &&
    headline.weekAverageKcal > headline.targetKcal;
  const protein = proteinNote(proteinG, target?.proteinG ?? null);
  const sessions = sessionNote(sessionsThisWeek);
  const verify = verifyQueueNote(catalog);
  const prov = useMemo(() => provenanceSummary(entries), [entries]);
  const presence = useMemo(() => presenceCells(clockToday, history), [clockToday, history]);
  const presenceLine = useMemo(() => presenceCopy(presence), [presence]);
  const weekNumber = isoWeekFromLogicalDate(clockToday);
  const boundaryClock = clock.dayStartsAt.slice(0, 5);

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

  function onPickDay(date: string) {
    if (date > clockToday) return;
    setViewDate(date === clockToday ? null : date);
  }

  function onAdd(slot: MealSlot) {
    openLogPalette(slot);
  }

  return (
    <section className={`${styles.panel} ${styles.diary}`} aria-labelledby="today-title" data-calories-log="">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Diary · week {weekNumber}</p>
          <h1 id="today-title" className={styles.title}>
            {formatDiaryDate(today)}
          </h1>
        </div>
        <p className={styles.headerAside}>
          Day boundary {boundaryClock} · {clock.timeZone}.
          <br />
          Totals follow your boundary, not midnight.
        </p>
      </header>

      <section className={styles.weekStrip} aria-label="This week" data-week-strip="">
        {strip.map((day) => (
          <button
            key={day.date}
            type="button"
            className={styles.weekDay}
            data-selected={day.selected ? 'true' : 'false'}
            data-future={day.future ? 'true' : 'false'}
            disabled={day.future}
            aria-label={`${day.weekday} ${day.dayNum}`}
            onClick={() => onPickDay(day.date)}
          >
            <span className={styles.weekDayTop}>
              <span className={styles.weekDow}>{day.weekday}</span>
              <span className={styles.weekNum}>{day.dayNum}</span>
            </span>
            <span className={styles.weekKcal}>{day.value}</span>
            <span className={styles.weekTrack}>
              <span className={styles.weekFill} style={{ width: `${day.fillPercent}%` }} />
            </span>
            <span className={styles.weekNote}>{day.note}</span>
          </button>
        ))}
      </section>

      <section className={styles.weekHero} aria-label="This week's average vs target">
        <div className={styles.weekHeroMain}>
          <p className={styles.statLabel}>This week&apos;s average vs target</p>
          <div className={styles.weekHeroValue}>
            <span className={styles.weekAvg}>
              {headline.weekAverageKcal === null ? '—' : headline.weekAverageKcal.toLocaleString('en-PH')}
            </span>
            <span className={styles.weekUnit}>kcal / day</span>
            {delta ? (
              <span className={styles.weekDelta} data-over={weekOver ? 'true' : 'false'}>
                {delta}
              </span>
            ) : null}
          </div>
          <div className={styles.weekHeroBar}>
            <span className={styles.weekHeroFill} style={{ width: `${bar.fillPercent}%` }} />
            {bar.tickPercent !== null ? (
              <span className={styles.weekHeroTick} style={{ left: `${bar.tickPercent}%` }} aria-hidden="true" />
            ) : null}
          </div>
          <div className={styles.weekHeroMeta}>
            <span>
              {headline.daysLogged === 0
                ? 'No days logged this week yet'
                : `${headline.daysLogged} day${headline.daysLogged === 1 ? '' : 's'} logged · from your entries`}
            </span>
            <span>
              {headline.targetKcal === null ? 'no target yet' : `target ${headline.targetKcal.toLocaleString('en-PH')}`}
            </span>
          </div>
        </div>
        <div className={styles.weekHeroStats}>
          {[
            { label: 'Protein', ...protein },
            { label: 'Sessions', ...sessions },
            { label: 'Verify queue', ...verify },
          ].map((stat) => (
            <div key={stat.label} className={styles.weekHeroStat}>
              <p className={styles.statLabel}>{stat.label}</p>
              <p className={styles.weekHeroStatValue}>{stat.value}</p>
              <p className={styles.statNote}>{stat.note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.diaryLog}>
        <div className={styles.diaryCols}>
          <span>Time</span>
          <span>Food</span>
          <span>Qty</span>
          <span>kcal</span>
          <span>Provenance</span>
          <span />
        </div>
        {groups.map((group) => (
          <div key={group.slot} data-meal-group={group.slot}>
            <div className={styles.mealHead}>
              <span className={styles.mealLabel}>{group.label}</span>
              <span className={styles.mealMeta}>
                <span className={styles.mealCount}>{group.countLabel}</span>
                <span className={styles.mealKcal}>{group.kcalLabel}</span>
              </span>
            </div>
            {group.rows.map((row) => {
              const kind = markKind(row);
              const badge = diaryBadge(row.source);
              return (
                <div key={row.id} className={styles.logRow} data-entry-row="">
                  <span className={styles.logTime}>{formatTime(row.logged_at, clock.timeZone)}</span>
                  <span className={styles.logName}>
                    <strong>{row.food_name_snapshot}</strong>
                    {row.serving_label_snapshot ? (
                      <span className={styles.logServing}>{row.serving_label_snapshot}</span>
                    ) : null}
                  </span>
                  <span className={styles.logQty}>
                    <input
                      key={`${row.id}:${row.updated_at}`}
                      defaultValue={row.quantity}
                      inputMode="decimal"
                      aria-label={`Quantity for ${row.food_name_snapshot}`}
                      onBlur={(event) => void commitQuantity(row, event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                      }}
                    />
                  </span>
                  <span className={styles.logKcal}>{Math.round(Number(row.kcal) || 0).toLocaleString('en-PH')}</span>
                  <span className={styles.logProv}>
                    {badge ? (
                      <span className={styles.sourceBadge} data-kind={badge.kind}>
                        {badge.label}
                      </span>
                    ) : null}
                    <span className={styles.mark} data-kind={kind} aria-hidden="true">
                      {kind === 'verified' ? '✓' : '~'}
                    </span>
                  </span>
                  <span className={styles.logRemove}>
                    <button type="button" aria-label={`Remove ${row.food_name_snapshot}`} onClick={() => void onDelete(row)}>
                      ×
                    </button>
                  </span>
                </div>
              );
            })}
            {group.empty ? (
              <div className={styles.mealEmpty}>
                <button type="button" data-add-meal={group.slot} onClick={() => onAdd(group.slot)}>
                  Nothing yet — ⌘K to add
                </button>
              </div>
            ) : null}
          </div>
        ))}
        <div className={styles.diaryFoot}>
          <span className={styles.diaryFootLabel}>Today · secondary to the week</span>
          <span className={styles.diaryFootKcal}>
            {todayKcal.toLocaleString('en-PH')}
            <span className={styles.diaryFootUnit}>kcal</span>
          </span>
        </div>
      </div>

      <div className={styles.diaryCards}>
        <div className={styles.provCard}>
          <p className={styles.statLabel}>Provenance, today</p>
          <div className={styles.provList}>
            {prov.map((bucket) => (
              <div key={bucket.key} className={styles.provRow}>
                <span
                  className={styles.mark}
                  data-kind={bucket.key === 'llm' ? 'estimate' : bucket.key === 'ph_core' ? 'plain' : 'verified'}
                  aria-hidden="true"
                >
                  {bucket.key === 'llm' ? '~' : bucket.key === 'ph_core' ? '~' : '✓'}
                </span>
                <span>{bucket.label}</span>
                <span className={styles.provValue}>{bucket.value}</span>
              </div>
            ))}
          </div>
          <p className={styles.provBlurb}>
            Every number on this page carries its source. Nothing is presented as measured when it
            was reasoned.
          </p>
        </div>
        <div className={styles.presenceCard}>
          <p className={styles.statLabel}>Presence · 4 weeks</p>
          <div className={styles.presenceGrid} aria-hidden="true">
            {presence.map((cell) => (
              <span
                key={cell.date}
                className={styles.presenceCell}
                data-on={cell.logged ? 'true' : 'false'}
                data-future={cell.future ? 'true' : 'false'}
              />
            ))}
          </div>
          <p className={styles.presenceBlurb}>{presenceLine}</p>
        </div>
      </div>

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

      <DeskMusPane userId={userId} logicalDate={today} module="calories" view="today" />
    </section>
  );
}
