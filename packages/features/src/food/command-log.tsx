'use client';

import { mealSlotAtHour, mealSlotLabel, type MealSlot } from '@kayamo/food/quick-log';
import {
  isEstimateResult,
  logCountsFromHistory,
  resolveFromCatalogFoods,
  SEARCH_DEBOUNCE_MS,
  servingKcal,
  showsVerifiedCheck,
  type CatalogFood,
  type FoodCandidate,
  type SearchHistoryEntry,
} from '@kayamo/food/search-ui';
import {
  getCachedServings,
  localHourFromInstant,
  logFoodEntry,
  tombstoneLocalFoodEntries,
  useLiveFoodHistory,
} from '@kayamo/offline';
import { createBrowserSupabase } from '@kayamo/db';
import { Toast } from '@kayamo/ui';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  clampSelectedIndex,
  catalogForCommandLog,
  cycleMealSlot,
  mealSlotFromDigit,
  OPEN_LOG_EVENT,
  PREFILL_LOG_EVENT,
  servingIdForLabel,
  toLogInputFromCandidate,
} from './command-log-model';
import { catalogFromCache, hydrateVisibleCatalog } from './hydrate-catalog';
import { hydrateFoodHistory } from './hydrate-food-history';
import { ProvenanceKcal } from './provenance';
import styles from './command-log.module.css';

const UNDO_MS = 8000;
const SLOTS: MealSlot[] = ['almusal', 'tanghalian', 'meryenda', 'hapunan'];

function toHistory(entry: {
  food_id: string | null;
  food_name_snapshot: string;
  logged_at: string;
  quantity: string;
  grams: string;
  serving_id: string | null;
  serving_label_snapshot: string | null;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  source: string;
  resolved_via: string;
  confidence: string;
}): SearchHistoryEntry | null {
  if (!entry.food_id) return null;
  return {
    foodId: entry.food_id,
    name: entry.food_name_snapshot,
    loggedAtMs: Date.parse(entry.logged_at),
    quantity: entry.quantity,
    grams: entry.grams,
    servingId: entry.serving_id,
    servingLabel: entry.serving_label_snapshot,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g,
    sugar_g: entry.sugar_g,
    sodium_mg: entry.sodium_mg,
    source: entry.source,
    resolvedVia: entry.resolved_via,
    confidence: entry.confidence,
  };
}

export function CommandLog({ userId }: { userId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const listId = useId();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(0);
  const [qtyMode, setQtyMode] = useState(false);
  const [qty, setQty] = useState('1');
  const [mealSlot, setMealSlot] = useState<MealSlot>('tanghalian');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ ids: string[]; message: string } | null>(null);
  const [clock, setClock] = useState({ timeZone: 'Asia/Manila', dayStartsAt: '00:00:00' });
  const [catalog, setCatalog] = useState<CatalogFood[]>([]);

  const historyRows = useLiveFoodHistory(userId);
  const logCounts = useMemo(() => {
    const history = historyRows.flatMap((row) => toHistory(row) ?? []);
    return logCountsFromHistory(history);
  }, [historyRows]);

  const highlighted = results[selected] ?? null;

  const openPalette = useCallback((prefill?: string) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const hour = localHourFromInstant(new Date().toISOString(), clock.timeZone);
    setMealSlot(mealSlotAtHour(hour));
    setQuery(prefill ?? '');
    setResults([]);
    setSelected(0);
    setQtyMode(false);
    setError(null);
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [clock.timeZone]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (dialog.open) dialog.close();
      else openPalette();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPalette]);

  useEffect(() => {
    function onPrefill(event: Event) {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query?.trim();
      if (!query) return;
      openPalette(query);
    }
    window.addEventListener(PREFILL_LOG_EVENT, onPrefill);
    function onOpen() {
      openPalette();
    }
    window.addEventListener(OPEN_LOG_EVENT, onOpen);
    return () => {
      window.removeEventListener(PREFILL_LOG_EVENT, onPrefill);
      window.removeEventListener(OPEN_LOG_EVENT, onOpen);
    };
  }, [openPalette]);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    void (async () => {
      try {
        const next = await hydrateFoodHistory({ client, userId });
        if (!cancelled) setClock(next);
      } catch {
        // Default Manila clock is enough to infer a meal slot.
      }
      try {
        const cached = await catalogFromCache();
        if (!cancelled && cached.length > 0) setCatalog(catalogForCommandLog(cached));
        const remote = await hydrateVisibleCatalog();
        if (!cancelled) setCatalog(catalogForCommandLog(remote));
      } catch {
        // Dexie cache is enough while offline.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void resolveFromCatalogFoods(text, userId, catalog, logCounts).then((hits) => {
        if (cancelled) return;
        setResults(hits);
        setSelected(0);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [catalog, logCounts, query, userId]);

  useEffect(() => {
    if (!qtyMode) return;
    qtyRef.current?.focus();
    qtyRef.current?.select();
  }, [qtyMode]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function showUndo(ids: string[], message: string) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ ids, message });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function logCandidate(candidate: FoodCandidate, quantityOverride?: number) {
    setError(null);
    const servings = await getCachedServings(candidate.foodId);
    const servingId = servingIdForLabel(servings, candidate.portion.servingLabel);
    const input = toLogInputFromCandidate({
      userId,
      mealSlot,
      candidate,
      servingId,
      timeZone: clock.timeZone,
      dayStartsAt: clock.dayStartsAt,
      quantityOverride,
    });
    if (!input) {
      setError('That result is not in the catalog yet, so it cannot be logged.');
      return;
    }
    try {
      const row = await logFoodEntry(input);
      const label = mealSlotLabel(mealSlot, 'taglish');
      setStatus(`Logged ${candidate.name} · ${label}`);
      showUndo([row.id], `Logged ${candidate.name}`);
      setQuery('');
      setResults([]);
      setSelected(0);
      setQtyMode(false);
      setQty('1');
      inputRef.current?.focus();
    } catch {
      setError('Could not save. Try again.');
    }
  }

  async function onUndo() {
    if (!undo) return;
    const ids = undo.ids;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await tombstoneLocalFoodEntries({ ids, userId });
    setStatus('Undid last log');
  }

  function onDialogKey(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      if (qtyMode) {
        event.preventDefault();
        setQtyMode(false);
        inputRef.current?.focus();
      }
      return;
    }
    if (event.altKey && mealSlotFromDigit(event.key)) {
      event.preventDefault();
      const slot = mealSlotFromDigit(event.key);
      if (slot) setMealSlot(slot);
      return;
    }
    if (event.key === '[' || event.key === ']') {
      event.preventDefault();
      setMealSlot((current) => cycleMealSlot(current, event.key === ']' ? 1 : -1));
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => clampSelectedIndex(index + 1, results.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => clampSelectedIndex(index - 1, results.length));
      return;
    }
    if (event.key === 'Tab' && highlighted && !qtyMode) {
      event.preventDefault();
      setQty(String(highlighted.portion.amount || 1));
      setQtyMode(true);
      return;
    }
    if (event.key === 'Enter') {
      if (!highlighted) return;
      event.preventDefault();
      if (qtyMode) {
        const amount = Number(qty);
        void logCandidate(
          highlighted,
          Number.isFinite(amount) && amount > 0 ? amount : undefined,
        );
        return;
      }
      void logCandidate(highlighted);
    }
  }

  const activeId = highlighted ? `${listId}-${highlighted.foodId}` : undefined;

  return (
    <>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onKeyDown={onDialogKey}
        onClose={() => {
          setQtyMode(false);
          setQuery('');
          setResults([]);
        }}
      >
        <div className={styles.body}>
          <div className={styles.chrome}>
            <h2 id={titleId} className={styles.title}>
              Log food
            </h2>
            <div className={styles.slots} role="group" aria-label="Meal slot">
              {SLOTS.map((slot, index) => (
                <button
                  key={slot}
                  type="button"
                  className={styles.slot}
                  data-on={mealSlot === slot ? 'true' : 'false'}
                  aria-pressed={mealSlot === slot}
                  onClick={() => setMealSlot(slot)}
                >
                  {index + 1} {mealSlotLabel(slot, 'taglish')}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.query}>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 200))}
              placeholder="kanin, adobo, sinaing…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-expanded={results.length > 0}
              role="combobox"
            />
          </div>
          <ul id={listId} className={styles.list} role="listbox">
            {results.map((hit, index) => (
              <li key={hit.foodId} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${hit.foodId}`}
                  role="option"
                  aria-selected={index === selected}
                  data-active={index === selected ? 'true' : 'false'}
                  className={styles.row}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => {
                    setSelected(index);
                    void logCandidate(hit);
                  }}
                >
                  <div>
                    <p className={styles.name}>{hit.name}</p>
                    <p className={styles.meta}>{hit.portion.servingLabel}</p>
                  </div>
                  <div className={styles.kcal}>
                    <ProvenanceKcal
                      kcal={servingKcal(hit)}
                      source={hit.source}
                      verified={showsVerifiedCheck(hit)}
                      estimate={isEstimateResult(hit)}
                      servingLabel={hit.portion.servingLabel}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {query.trim() && !searching && results.length === 0 ? (
            <p className={styles.empty}>No catalog match. USDA and brands stay out of this palette.</p>
          ) : null}
          {qtyMode && highlighted ? (
            <div className={styles.qty}>
              <label htmlFor={`${listId}-qty`}>Quantity</label>
              <input
                id={`${listId}-qty`}
                ref={qtyRef}
                type="number"
                min={0.1}
                step="any"
                value={qty}
                onChange={(event) => setQty(event.target.value)}
              />
              <span>{highlighted.portion.servingLabel}</span>
            </div>
          ) : null}
          <div className={styles.foot}>
            <p>
              <span className={styles.k}>↑↓</span> move <span className={styles.k}>Enter</span> log{' '}
              <span className={styles.k}>Tab</span> qty <span className={styles.k}>⌥1–4</span> meal{' '}
              <span className={styles.k}>Esc</span> close
            </p>
            <p className={styles.status} role="status">
              {error ?? status ?? (searching ? 'Searching…' : null)}
            </p>
          </div>
        </div>
      </dialog>
      {undo ? (
        <div className={styles.toastDock}>
          <Toast
            message={undo.message}
            action={
              <button type="button" onClick={() => void onUndo()}>
                Undo
              </button>
            }
          />
        </div>
      ) : null}
    </>
  );
}
