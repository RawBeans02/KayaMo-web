'use client';

import { createBrowserSupabase, listServings, listVisibleFoods } from '@kayamo/db';
import {
  foodRowToCatalog,
  frequentLoggedFoods,
  isEstimateResult,
  logCountsFromHistory,
  mergeCandidatesById,
  nutrientsFromPer100g,
  persistableFoodId,
  recentLoggedFoods,
  remoteOnlyCandidates,
  resolveFromCatalogFoods,
  SEARCH_DEBOUNCE_MS,
  servingKcal,
  showsVerifiedCheck,
  sourceBadge,
  toConfidenceString,
  type FoodCandidate,
  type SearchHistoryEntry,
} from '@kayamo/food/search-ui';
import { mealSlotAtHour } from '@kayamo/food/quick-log';
import type { LogFoodEntryInput } from '@kayamo/offline';
import {
  cacheFoodWithServings,
  getCachedServings,
  listCachedFoodsWithServings,
  localHourFromInstant,
  logFoodEntries,
  tombstoneLocalFoodEntries,
  useLiveFoodHistory,
} from '@kayamo/offline';
import { Button, EmptyState, NumberDisplay, Toast } from '@kayamo/ui';
import { apiFetch } from '../api/api-origin';
import { hydrateFoodHistory } from './hydrate-food-history';
import { PHONE_TOAST_DOCK_CLASS } from './phone-chrome';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  QuantitySheet,
  sheetServingsFromFoodServings,
  toSheetServings,
  type QuantityTarget,
  type SheetServing,
} from './quantity-form';

const UNDO_MS = 8000;

type ResolveResponse = {
  candidates?: FoodCandidate[];
  error?: string;
};

type Tab = 'recent' | 'frequent';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function asLogSource(value: string): LogFoodEntryInput['source'] {
  if (value === 'ph_core' || value === 'usda_fdc' || value === 'off' || value === 'user' || value === 'llm') {
    return value;
  }
  return 'user';
}

function asResolvedVia(value: string): LogFoodEntryInput['resolvedVia'] {
  if (
    value === 'ph_core' ||
    value === 'usda_fdc' ||
    value === 'off' ||
    value === 'user' ||
    value === 'llm' ||
    value === 'recipe'
  ) {
    return value;
  }
  return 'user';
}

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

function candidateToTarget(candidate: FoodCandidate, servingId: string | null): QuantityTarget {
  const nutrients = nutrientsFromPer100g(candidate.per100g, candidate.portion.grams);
  return {
    foodId: candidate.foodId,
    name: candidate.name,
    ...nutrients,
    quantity: String(candidate.portion.amount || 1),
    grams: String(candidate.portion.grams),
    servingId,
    servingLabel: candidate.portion.servingLabel,
    source: candidate.source,
    resolvedVia: candidate.source,
    confidence: toConfidenceString(candidate.confidence),
  };
}

function historyToTarget(entry: SearchHistoryEntry): QuantityTarget {
  return {
    foodId: entry.foodId,
    name: entry.name,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g,
    sugar_g: entry.sugar_g,
    sodium_mg: entry.sodium_mg,
    quantity: entry.quantity,
    grams: entry.grams,
    servingId: entry.servingId,
    servingLabel: entry.servingLabel,
    source: entry.source,
    resolvedVia: entry.resolvedVia,
    confidence: entry.confidence,
  };
}

function EmptyActions({
  onAddProduct,
  onDescribeInChat,
}: {
  onAddProduct: () => void;
  onDescribeInChat: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="secondary" size="lg" onClick={onDescribeInChat}>
        Describe it in chat
      </Button>
      <button
        type="button"
        onClick={onAddProduct}
        className="min-h-11 text-left font-data text-caption uppercase tracking-[0.14em] text-muted"
      >
        Add it yourself
      </button>
    </div>
  );
}

function ResultRow({
  candidate,
  remote,
  onPick,
}: {
  candidate: FoodCandidate;
  remote?: boolean;
  onPick: (candidate: FoodCandidate) => void;
}) {
  const badge = sourceBadge(candidate.source);
  const estimate = isEstimateResult(candidate);
  const verified = showsVerifiedCheck(candidate);
  return (
    <li>
      <button
        type="button"
        data-testid="food-search-result"
        data-remote={remote ? '1' : '0'}
        onClick={() => onPick(candidate)}
        className="flex w-full items-start justify-between gap-3 border-y border-line py-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-body text-body text-text">
            {candidate.name}
            {verified ? (
              <span className="ml-2 font-data text-caption text-accent" aria-label="Verified">
                ✓
              </span>
            ) : null}
          </p>
          {candidate.brand ? (
            <p className="font-data text-caption text-muted">{candidate.brand}</p>
          ) : null}
          {estimate ? (
            <p className="mt-1 font-data text-caption uppercase tracking-[0.14em] text-warning">
              estimate
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          {badge ? (
            <p className="font-data text-caption uppercase tracking-[0.14em] text-muted" data-testid="source-badge">
              {badge}
            </p>
          ) : null}
          <NumberDisplay value={String(servingKcal(candidate))} unit="kcal" size="sm" />
          <p className="font-data text-caption text-muted">{candidate.portion.servingLabel}</p>
        </div>
      </button>
    </li>
  );
}

export function FoodSearch({
  userId,
  onAddProduct,
  onDescribeInChat,
  loggedAt,
  toastDockClassName = PHONE_TOAST_DOCK_CLASS,
}: {
  userId: string;
  onAddProduct: () => void;
  onDescribeInChat: () => void;
  loggedAt?: string;
  toastDockClassName?: string;
}) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const [timeZone, setTimeZone] = useState('Asia/Manila');
  const [dayStartsAt, setDayStartsAt] = useState('00:00:00');
  const [cacheGen, setCacheGen] = useState(0);
  const [results, setResults] = useState<{
    q: string;
    local: FoodCandidate[];
    remote: FoodCandidate[];
    searching: boolean;
    error: string | null;
  }>({ q: '', local: [], remote: [], searching: false, error: null });
  const [sheet, setSheet] = useState<{ target: QuantityTarget; servings: SheetServing[] } | null>(
    null,
  );
  const [logError, setLogError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ ids: string[]; message: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);

  const historyRows = useLiveFoodHistory(userId);
  const history = useMemo(
    () => historyRows.flatMap((row) => toHistory(row) ?? []),
    [historyRows],
  );
  const logCounts = useMemo(() => logCountsFromHistory(history), [history]);
  const recent = useMemo(() => recentLoggedFoods(history), [history]);
  const frequent = useMemo(() => frequentLoggedFoods(history), [history]);

  const q = query.trim();
  const localHits = results.q === q ? results.local : [];
  const remoteHits = results.q === q ? results.remote : [];
  const searching = Boolean(q) && (results.q !== q || results.searching);
  const error = results.q === q ? results.error : null;
  const hour = localHourFromInstant(new Date().toISOString(), timeZone);
  const mealSlot = mealSlotAtHour(hour);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    async function hydrate() {
      try {
        const { timeZone: tz, dayStartsAt: start } = await hydrateFoodHistory({ client, userId });
        if (cancelled) return;
        setTimeZone(tz);
        setDayStartsAt(start);
        const remoteFoods = await listVisibleFoods(client);
        for (const food of remoteFoods) {
          const servings = await listServings(client, food.id);
          await cacheFoodWithServings(food, servings);
        }
      } catch {
        // Dexie cache is enough offline.
      }
      if (!cancelled) setCacheGen((n) => n + 1);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (!text) return;

    let cancelled = false;
    const ac = new AbortController();
    let localAcc: FoodCandidate[] = [];
    let fullAcc: FoodCandidate[] = [];

    function publish(searching: boolean, nextError: string | null = null) {
      if (cancelled) return;
      setResults({
        q: text,
        local: localAcc,
        remote: remoteOnlyCandidates(localAcc, fullAcc),
        searching,
        error: nextError,
      });
    }

    void (async () => {
      try {
        const cached = await listCachedFoodsWithServings();
        const foods = cached.map(({ food, servings }) =>
          foodRowToCatalog(food, servings, food.name_tl ?? []),
        );
        localAcc = mergeCandidatesById(
          localAcc,
          await resolveFromCatalogFoods(text, userId, foods, logCounts),
        );
        publish(true);
      } catch {
        // IndexedDB may be unavailable on first paint.
      }
    })();

    const timer = window.setTimeout(() => {
      void (async () => {
        let nextError: string | null = null;
        try {
          const localRes = await apiFetch(
            `/api/foods/resolve?q=${encodeURIComponent(text)}&local=1`,
            { signal: ac.signal },
          );
          const localJson = (await localRes.json()) as ResolveResponse;
          if (cancelled) return;
          if (!localRes.ok) {
            nextError = localJson.error ?? 'Search failed.';
          } else {
            localAcc = mergeCandidatesById(localAcc, localJson.candidates ?? []);
          }
          publish(true, nextError);

          const fullRes = await apiFetch(`/api/foods/resolve?q=${encodeURIComponent(text)}`, {
            signal: ac.signal,
          });
          const fullJson = (await fullRes.json()) as ResolveResponse;
          if (cancelled) return;
          if (!fullRes.ok) {
            nextError = fullJson.error ?? 'Search failed.';
          } else {
            fullAcc = fullJson.candidates ?? [];
          }
          publish(false, nextError);
        } catch (err) {
          if (cancelled || isAbortError(err)) return;
          publish(false, 'Search failed. Try again.');
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [query, userId, logCounts, cacheGen]);

  const openCandidate = useCallback(async (candidate: FoodCandidate) => {
    const id = persistableFoodId(candidate.foodId);
    const cached = id ? await getCachedServings(id) : [];
    const servings =
      cached.length > 0 ? toSheetServings(cached) : sheetServingsFromFoodServings(candidate.servings);
    const servingId =
      servings.find((row) => row.label === candidate.portion.servingLabel)?.id ??
      servings.find((row) => row.isDefault)?.id ??
      servings[0]?.id ??
      null;
    setSheet({ target: candidateToTarget(candidate, servingId), servings });
  }, []);

  const openHistory = useCallback(async (entry: SearchHistoryEntry) => {
    const cached = await getCachedServings(entry.foodId);
    const gramsEach = Number(entry.grams) / Math.max(1, Number(entry.quantity) || 1);
    setSheet({
      target: historyToTarget(entry),
      servings:
        cached.length > 0
          ? toSheetServings(cached)
          : [
              {
                id: entry.servingId,
                label: entry.servingLabel ?? 'g',
                grams: gramsEach || 1,
                isDefault: true,
              },
            ],
    });
  }, []);

  function showUndo(ids: string[], message: string) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ ids, message });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function logTarget(next: QuantityTarget) {
    setLogError(null);
    setSheet(null);
    try {
      const rows = await logFoodEntries([
        {
          userId,
          mealSlot,
          foodId: persistableFoodId(next.foodId),
          foodName: next.name,
          quantity: next.quantity,
          grams: next.grams,
          kcal: next.kcal,
          protein_g: next.protein_g,
          carbs_g: next.carbs_g,
          fat_g: next.fat_g,
          fiber_g: next.fiber_g,
          sugar_g: next.sugar_g,
          sodium_mg: next.sodium_mg,
          source: asLogSource(next.source),
          resolvedVia: asResolvedVia(next.resolvedVia),
          inputMethod: 'search',
          servingId: next.servingId,
          servingLabel: next.servingLabel,
          confidence: next.confidence,
          timeZone,
          dayStartsAt,
          loggedAt,
        },
      ]);
      showUndo(
        rows.map((row) => row.id),
        `Logged ${next.name}`,
      );
    } catch {
      setLogError('Could not save locally. Try again.');
    }
  }

  async function onUndo() {
    if (!undo) return;
    const ids = undo.ids;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await tombstoneLocalFoodEntries({ ids, userId });
  }

  const emptySearch = q.length > 0 && !searching && localHits.length === 0 && remoteHits.length === 0;
  const list = tab === 'recent' ? recent : frequent;

  return (
    <div className="mt-2 flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="sr-only">Search foods</span>
        <input
          data-testid="food-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 200))}
          placeholder="Food, brand, or barcode"
          autoFocus
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="min-h-12 border-b border-line bg-transparent px-0 font-body text-body text-text outline-none placeholder:text-muted"
        />
      </label>

      {error || logError ? (
        <p className="font-body text-body text-warning">{error ?? logError}</p>
      ) : null}

      {q ? (
        <div className="flex flex-col gap-4">
          {localHits.length > 0 ? (
            <ul className="flex flex-col">
              {localHits.map((hit) => (
                <ResultRow key={hit.foodId} candidate={hit} onPick={(row) => void openCandidate(row)} />
              ))}
            </ul>
          ) : null}

          {searching && remoteHits.length === 0 ? (
            <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">
              Looking farther…
            </p>
          ) : null}

          {remoteHits.length > 0 ? (
            <div>
              <p className="mb-2 font-data text-caption uppercase tracking-[0.14em] text-muted">
                From the network
              </p>
              <ul className="flex flex-col" data-testid="food-search-remote">
                {remoteHits.map((hit) => (
                  <ResultRow
                    key={hit.foodId}
                    candidate={hit}
                    remote
                    onPick={(row) => void openCandidate(row)}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {emptySearch ? (
            <EmptyState
              title="Nothing matched"
              body="Try another name or barcode, or add a custom food from a nutrition label."
              action={<EmptyActions onAddProduct={onAddProduct} onDescribeInChat={onDescribeInChat} />}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div role="tablist" className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              role="tab"
              aria-selected={tab === 'recent'}
              variant={tab === 'recent' ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setTab('recent')}
            >
              Recent
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={tab === 'frequent'}
              variant={tab === 'frequent' ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setTab('frequent')}
            >
              Frequent
            </Button>
          </div>

          {list.length > 0 ? (
            <ul className="flex flex-col">
              {list.map((entry) => (
                <li key={`${tab}:${entry.foodId}`}>
                  <button
                    type="button"
                    onClick={() => void openHistory(entry)}
                    className="flex w-full items-start justify-between gap-3 border-y border-line py-3 text-left"
                  >
                    <p className="font-body text-body text-text">{entry.name}</p>
                    <NumberDisplay
                      value={String(Math.round(Number(entry.kcal)))}
                      unit="kcal"
                      size="sm"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={tab === 'recent' ? 'No recent foods' : 'No frequent foods'}
              body="Search above, add a product, or describe it in chat."
              action={<EmptyActions onAddProduct={onAddProduct} onDescribeInChat={onDescribeInChat} />}
            />
          )}
        </div>
      )}

      {sheet ? (
        <QuantitySheet
          key={sheet.target.foodId}
          target={sheet.target}
          servings={sheet.servings}
          onClose={() => setSheet(null)}
          onConfirm={(next) => void logTarget(next)}
        />
      ) : null}

      {undo ? (
        <div className={toastDockClassName}>
          <Toast
            message={undo.message}
            action={
              <button type="button" onClick={() => void onUndo()} className="font-semibold text-accent">
                Undo
              </button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
