'use client';

import { isMealSlot, mealSlotAtHour, mealSlotLabel, type MealSlot } from '@kayamo/food/quick-log';
import { useDeskLocale } from '../i18n/desk-locale';
import {
  isEstimateResult,
  logCountsFromHistory,
  resolveFromCatalogFoods,
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
  PALETTE_DEBOUNCE_MS,
  PALETTE_KEYS,
  PALETTE_LEAVE_ACTIONS,
  PALETTE_SKELETONS,
  aliasLine,
  candidateFromCatalogFood,
  catalogForCommandLog,
  clampSelectedIndex,
  cycleMealSlot,
  frequencyLabel,
  idlePaletteStatus,
  leaveHrefFromPaletteKey,
  loggedStatus,
  mealSlotFromDigit,
  OPEN_LOG_EVENT,
  paletteStateLabel,
  paletteView,
  plateTotalKcal,
  PREFILL_LOG_EVENT,
  readPrefillLogEvent,
  previewQtyKcal,
  readyCatalogFoods,
  servingCaption,
  servingIdForLabel,
  toLogInputFromCandidate,
  type PlateItem,
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

function HitRow({
  hit,
  aliases,
  kind,
  active,
  optionId,
  freq,
  onHover,
  onLog,
}: {
  hit: FoodCandidate;
  aliases: string;
  kind: 'ready' | 'results';
  active: boolean;
  optionId: string;
  freq: string;
  onHover: () => void;
  onLog: () => void;
}) {
  return (
    <button
      type="button"
      id={optionId}
      role="option"
      aria-selected={active}
      data-active={active ? 'true' : 'false'}
      data-kind={kind}
      className={styles.row}
      onMouseEnter={onHover}
      onClick={onLog}
    >
      <span>
        <span className={styles.name}>{hit.name}</span>
        {kind === 'results' && aliases ? (
          <span className={styles.aliases}>{aliases}</span>
        ) : (
          <span className={styles.meta}>{servingCaption(hit.portion)}</span>
        )}
      </span>
      {kind === 'ready' ? (
        <span className={styles.freq}>{freq}</span>
      ) : (
        <span className={styles.serving}>{servingCaption(hit.portion)}</span>
      )}
      <span className={styles.kcal}>
        <ProvenanceKcal
          kcal={servingKcal(hit)}
          source={hit.source}
          verified={showsVerifiedCheck(hit)}
          estimate={isEstimateResult(hit)}
          servingLabel={hit.portion.servingLabel}
          large={kind === 'results'}
        />
      </span>
    </button>
  );
}

/**
 * Direct user logging through `logFoodEntry` + Toast undo.
 * Do not route this through ProposalCard — that card is for Mus-proposed writes.
 */
export function CommandLog({
  userId,
  onLeave,
}: {
  userId: string;
  onLeave?: (href: string) => void;
}) {
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
  const locale = useDeskLocale();
  const [mealSlot, setMealSlot] = useState<MealSlot>('tanghalian');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ ids: string[]; message: string } | null>(null);
  const [plate, setPlate] = useState<PlateItem[]>([]);
  const [clock, setClock] = useState({ timeZone: 'Asia/Manila', dayStartsAt: '00:00:00' });
  const [catalog, setCatalog] = useState<CatalogFood[]>([]);

  const historyRows = useLiveFoodHistory(userId);
  const logCounts = useMemo(() => {
    const history = historyRows.flatMap((row) => toHistory(row) ?? []);
    return logCountsFromHistory(history);
  }, [historyRows]);

  const catalogById = useMemo(() => {
    const map = new Map<string, CatalogFood>();
    for (const food of catalog) map.set(food.id, food);
    return map;
  }, [catalog]);

  const view = paletteView(query, searching, results.length);
  const readyHits = useMemo(
    () =>
      readyCatalogFoods(catalog, logCounts).map((food) =>
        candidateFromCatalogFood(food, logCounts.get(food.id) ?? 0),
      ),
    [catalog, logCounts],
  );
  const hits = view === 'ready' ? readyHits : view === 'results' ? results : [];
  const highlighted = hits[clampSelectedIndex(selected, hits.length)] ?? null;

  const resetSession = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelected(0);
    setQtyMode(false);
    setQty('1');
    setSearching(false);
    setError(null);
    setPlate([]);
  }, []);

  const openPalette = useCallback((prefill?: string, mealSlotOverride?: MealSlot) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const hour = localHourFromInstant(new Date().toISOString(), clock.timeZone);
    setMealSlot(mealSlotOverride ?? mealSlotAtHour(hour));
    resetSession();
    setQuery(prefill ?? '');
    setStatus(null);
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [clock.timeZone, resetSession]);

  const leavePalette = useCallback((href: string) => {
    dialogRef.current?.close();
    onLeave?.(href);
  }, [onLeave]);

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
      const query = readPrefillLogEvent(event);
      if (!query) return;
      openPalette(query);
    }
    window.addEventListener(PREFILL_LOG_EVENT, onPrefill);
    function onOpen(event: Event) {
      const slot = (event as CustomEvent<{ mealSlot?: string }>).detail?.mealSlot;
      openPalette(undefined, slot && isMealSlot(slot) ? slot : undefined);
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
        await hydrateVisibleCatalog();
        const after = await catalogFromCache();
        if (!cancelled && after.length > 0) setCatalog(catalogForCommandLog(after));
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
    setResults([]);
    const timer = window.setTimeout(() => {
      void resolveFromCatalogFoods(text, userId, catalog, logCounts).then((hits) => {
        if (cancelled) return;
        setResults(hits);
        setSelected(0);
        setSearching(false);
      });
    }, PALETTE_DEBOUNCE_MS);
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
      const label = mealSlotLabel(mealSlot, locale);
      setStatus(loggedStatus(label));
      showUndo([row.id], `Logged ${candidate.name}`);
      setPlate((items) => [
        ...items,
        { id: row.id, label: candidate.name, kcal: Math.round(Number(input.kcal)) },
      ]);
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
    setPlate((items) => items.filter((item) => !ids.includes(item.id)));
    setStatus('Undid last log');
  }

  async function removePlateItem(id: string) {
    await tombstoneLocalFoodEntries({ ids: [id], userId });
    setPlate((items) => items.filter((item) => item.id !== id));
    if (undo?.ids.includes(id)) {
      setUndo(null);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    }
  }

  function onDialogKey(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (view === 'none') {
      const href = leaveHrefFromPaletteKey(event);
      if (href) {
        event.preventDefault();
        leavePalette(href);
        return;
      }
    }
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
      setSelected((index) => clampSelectedIndex(index + 1, hits.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => clampSelectedIndex(index - 1, hits.length));
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
  const plateKcal = plateTotalKcal(plate);
  const statusText = error ?? status ?? idlePaletteStatus(plate.length);
  const statusOk = !error && Boolean(status?.startsWith('Logged'));

  return (
    <>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        data-palette="log"
        data-palette-view={view}
        onKeyDown={onDialogKey}
        onClose={() => {
          resetSession();
        }}
      >
        <div className={styles.body}>
          <div className={styles.chrome}>
            <p id={titleId} className={styles.eyebrow}>
              Log food
            </p>
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
                  <span className={styles.digit}>{index + 1}</span>
                  <span>{mealSlotLabel(slot, locale)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.query}>
            <span className={styles.searchIcon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 200))}
              placeholder="Rice, lentils, chicken, yogurt…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-expanded={hits.length > 0}
              aria-busy={searching}
              role="combobox"
            />
            <span className={styles.stateLabel}>{paletteStateLabel(view, results.length)}</span>
          </div>
          <div id={listId} className={styles.list}>
            {view === 'ready' ? (
              <>
                <p className={styles.readyLabel}>Recent and saved foods</p>
                <ul role="listbox">
                  {readyHits.map((hit, index) => (
                    <li key={hit.foodId} role="presentation">
                      <HitRow
                        hit={hit}
                        aliases=""
                        kind="ready"
                        active={index === clampSelectedIndex(selected, readyHits.length)}
                        optionId={`${listId}-${hit.foodId}`}
                        freq={frequencyLabel(hit.timesLogged)}
                        onHover={() => setSelected(index)}
                        onLog={() => {
                          setSelected(index);
                          void logCandidate(hit);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {view === 'searching' ? (
              <div>
                <p className={styles.searchLabel}>Searching saved foods · aliases · your history</p>
                {PALETTE_SKELETONS.map((sk) => (
                  <div key={sk.w1} className={styles.skeleton} aria-hidden="true">
                    <span className={styles.bones}>
                      <span className={styles.bone} style={{ width: sk.w1 }} />
                      <span className={`${styles.bone} ${styles.boneThin}`} style={{ width: sk.w2 }} />
                    </span>
                    <span className={`${styles.bone} ${styles.boneKcal}`} />
                  </div>
                ))}
              </div>
            ) : null}
            {view === 'results' ? (
              <ul role="listbox">
                {results.map((hit, index) => {
                  const food = catalogById.get(hit.foodId);
                  return (
                    <li key={hit.foodId} role="presentation">
                      <HitRow
                        hit={hit}
                        aliases={food ? aliasLine(food) : ''}
                        kind="results"
                        active={index === clampSelectedIndex(selected, results.length)}
                        optionId={`${listId}-${hit.foodId}`}
                        freq=""
                        onHover={() => setSelected(index)}
                        onLog={() => {
                          setSelected(index);
                          void logCandidate(hit);
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {view === 'none' ? (
              <div className={styles.none}>
                <p className={styles.noneTitle}>No saved food matches “{query.trim()}”.</p>
                <p className={styles.noneBody}>
                  Search worldwide foods, create a custom entry from a label or recipe,
                  or ask Lis to help identify it. Nutrition values need a source.
                </p>
                <div className={styles.noneActions}>
                  {PALETTE_LEAVE_ACTIONS.map((action) => (
                    <button
                      key={action.title}
                      type="button"
                      className={styles.noneAction}
                      onClick={() => leavePalette(action.href)}
                    >
                      <span>
                        <strong>{action.title}</strong>
                        <span>{action.sub}</span>
                      </span>
                      <kbd className={styles.k}>{action.key}</kbd>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
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
              <span className={styles.qtyServing}>× {servingCaption(highlighted.portion)}</span>
              <span className={styles.qtyKcal}>
                {previewQtyKcal(servingKcal(highlighted), highlighted.portion.amount, qty).toLocaleString('en-PH')}
                <span className={styles.qtyUnit}>kcal</span>
              </span>
            </div>
          ) : null}
          <div className={styles.tray}>
            {plate.length > 0 ? (
              <div className={styles.plate} aria-label="This plate">
                <div className={styles.chips}>
                  {plate.map((item) => (
                    <span key={item.id} className={styles.chip}>
                      <span>{item.label}</span>
                      <span className={styles.chipKcal}>{item.kcal.toLocaleString('en-PH')}</span>
                      <button
                        type="button"
                        className={styles.chipRemove}
                        aria-label={`Remove ${item.label}`}
                        onClick={() => void removePlateItem(item.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className={styles.plateTotal}>
                  <span className={styles.plateLabel}>This plate</span>
                  <span className={styles.plateValue}>{plateKcal.toLocaleString('en-PH')}</span>
                  <span className={styles.plateUnit}>kcal</span>
                </div>
              </div>
            ) : null}
            <div className={styles.foot}>
              <div className={styles.keys}>
                {PALETTE_KEYS.map((item) => (
                  <span key={item.key} className={styles.key}>
                    <kbd className={styles.k}>{item.key}</kbd>
                    <span>{item.label}</span>
                  </span>
                ))}
              </div>
              <p className={styles.status} data-ok={statusOk ? 'true' : 'false'} role="status">
                {statusText}
              </p>
            </div>
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
