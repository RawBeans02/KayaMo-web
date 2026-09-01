'use client';

import type { Food, Serving } from '@kayamo/db';
import { createBrowserSupabase, listServingsByFoodIds, listVisibleFoods } from '@kayamo/db';
import { logCountsFromHistory, type SearchHistoryEntry } from '@kayamo/food/search-ui';
import {
  cacheFoodWithServings,
  listCachedFoodsWithServings,
  recoverClosedOfflineDb,
  useLiveFoodHistory,
} from '@kayamo/offline';
import { ProposalCard, Toast } from '@kayamo/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { macrosOffByMoreThanFivePercent } from './atwater-check';
import { DeskMusPane } from '../desk/desk-mus';
import { useDeskClock } from '../desk/use-desk-clock';
import { indexMatchingQuery } from './foods-model';
import { migrateVerifyOverlay } from './verify-rpc';
import { readVerifyOverlay, replaceVerifyOverlay, upsertVerifyOverlay } from './verify-overlay';
import { waitForUserDb } from './wait-user-db';
import {
  applyOverlayToFood,
  atwaterFromDraft,
  draftFromFood,
  draftsEqual,
  driftCount,
  isBatchReady,
  meanConfidence,
  nextUnverifiedIndex,
  overlayFromFood,
  pcfLabel,
  verifyLede,
  type VerifyDraft,
  type VerifyOverlayEntry,
} from './verify-model';
import { moveVerifyIndex, sortVerifyRows } from './verify-rows';
import styles from './desk.module.css';

const UNDO_MS = 8000;

function toHistory(entry: {
  food_id: string | null;
  food_name_snapshot: string;
  logged_at: string;
}): SearchHistoryEntry | null {
  if (!entry.food_id) return null;
  return {
    foodId: entry.food_id,
    name: entry.food_name_snapshot,
    loggedAtMs: Date.parse(entry.logged_at),
    quantity: '1',
    grams: '100',
    servingId: null,
    servingLabel: null,
    kcal: '0',
    protein_g: '0',
    carbs_g: '0',
    fat_g: '0',
    fiber_g: '0',
    sugar_g: '0',
    sodium_mg: '0',
    source: 'ph_core',
    resolvedVia: 'ph_core',
    confidence: '0',
  };
}

function defaultServing(list: Serving[] | undefined): Serving | null {
  if (!list || list.length === 0) return null;
  return list.find((row) => row.is_default) ?? list[0] ?? null;
}

export function VerifyTable({ userId }: { userId: string }) {
  const { today } = useDeskClock(userId);
  const [foods, setFoods] = useState<Food[]>([]);
  const [servings, setServings] = useState<Map<string, Serving[]>>(new Map());
  const [overlay, setOverlay] = useState<Record<string, VerifyOverlayEntry>>({});
  const [drafts, setDrafts] = useState<Record<string, VerifyDraft>>({});
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ message: string; overlay: Record<string, VerifyOverlayEntry> } | null>(
    null,
  );
  const [batchOpen, setBatchOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');
  const jumpRef = useRef<HTMLInputElement>(null);
  const historyRows = useLiveFoodHistory(userId);

  const applyRows = useCallback((rows: Food[], nextOverlay: Record<string, VerifyOverlayEntry>) => {
    setFoods(rows.map((food) => applyOverlayToFood(food, nextOverlay[food.id])));
  }, []);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    const isCancelled = () => cancelled;
    void (async () => {
      const stored = readVerifyOverlay();
      let overlayForPaint = stored;
      if (!cancelled) setOverlay(stored);
      await waitForUserDb(userId, isCancelled);
      if (cancelled) return;

      try {
        const migrated = await migrateVerifyOverlay(
          {
            rpc: async (fn, args) => {
              const { error } = await client.rpc(fn as never, args as never);
              return { error };
            },
          },
          stored,
        );
        overlayForPaint = migrated.overlay;
        if (!cancelled) setOverlay(overlayForPaint);
      } catch {
        /* RPC is a database-lane concern; keep the local overlay. */
      }

      let cachedCount = 0;
      try {
        const cached = (await recoverClosedOfflineDb(() => listCachedFoodsWithServings())).filter(
          (row) => row.food.source === 'ph_core',
        );
        cachedCount = cached.length;
        if (!cancelled && cached.length > 0) {
          setServings(new Map(cached.map((row) => [row.food.id, row.servings])));
          applyRows(
            cached.map((row) => row.food),
            overlayForPaint,
          );
        }
      } catch {
        /* Network pull still runs; Dexie may still be catching up. */
      }

      try {
        const rows = (await listVisibleFoods(client)).filter((food) => food.source === 'ph_core');
        if (rows.length === 0) {
          if (!cancelled && cachedCount === 0) setError('Could not load PH core foods.');
          return;
        }
        const byId = await listServingsByFoodIds(
          client,
          rows.map((row) => row.id),
        );
        for (const food of rows) {
          await cacheFoodWithServings(applyOverlayToFood(food, overlayForPaint[food.id]), byId.get(food.id) ?? []);
        }
        if (cancelled) return;
        setServings(byId);
        applyRows(rows, overlayForPaint);
        setError(null);
      } catch {
        if (!cancelled && cachedCount === 0) setError('Could not load PH core foods.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRows, userId]);

  const logCounts = useMemo(() => {
    const history = historyRows.flatMap((row) => toHistory(row) ?? []);
    return logCountsFromHistory(history);
  }, [historyRows]);

  const rows = useMemo(() => sortVerifyRows(foods, logCounts), [foods, logCounts]);
  const activeRow = rows[active] ?? rows[0] ?? null;
  const committedDraft = activeRow ? draftFromFood(activeRow) : null;
  const draft = activeRow ? (drafts[activeRow.id] ?? committedDraft) : null;
  const dirty = Boolean(activeRow && draft && committedDraft && !draftsEqual(draft, committedDraft));
  const atwater = draft ? atwaterFromDraft(draft) : null;
  const serving = activeRow ? defaultServing(servings.get(activeRow.id)) : null;
  const verifiedCount = rows.filter((row) => row.verified_by_user).length;
  const queue = rows.map((row) => ({
    verified: row.verified_by_user,
    skipped: overlay[row.id]?.skipped === true,
  }));
  const batchRows = rows.filter((row) => isBatchReady(row, drafts[row.id] ?? draftFromFood(row)));

  const persist = useCallback(
    async (food: Food, nextDraft: VerifyDraft, flags: { verified: boolean; skipped: boolean }) => {
      const entry = overlayFromFood(food, nextDraft, flags, overlay[food.id]);
      const nextOverlay = upsertVerifyOverlay(food.id, entry);
      setOverlay(nextOverlay);
      const patched = applyOverlayToFood(food, entry);
      setFoods((current) => current.map((row) => (row.id === food.id ? patched : row)));
      await cacheFoodWithServings(patched, servings.get(food.id) ?? []);
      return nextOverlay;
    },
    [overlay, servings],
  );

  const jumpUnverified = useCallback(
    (direction: 1 | -1) => {
      setActive((index) => nextUnverifiedIndex(queue, index, direction));
    },
    [queue],
  );

  const saveActive = useCallback(async () => {
    if (!activeRow || !draft) return;
    const flags = overlay[activeRow.id] ?? { verified: activeRow.verified_by_user, skipped: false };
    await persist(activeRow, draft, { verified: flags.verified, skipped: flags.skipped === true });
    setDrafts((current) => {
      const next = { ...current };
      delete next[activeRow.id];
      return next;
    });
  }, [activeRow, draft, overlay, persist]);

  const verifyActive = useCallback(async () => {
    if (!activeRow || !draft) return;
    const turningOn = !activeRow.verified_by_user;
    const snapshot = readVerifyOverlay();
    const foodId = activeRow.id;
    await persist(activeRow, draft, { verified: turningOn, skipped: false });
    setDrafts((current) => {
      const next = { ...current };
      delete next[foodId];
      return next;
    });
    setUndo({
      message: turningOn ? `Verified ${activeRow.name}` : `Unverified ${activeRow.name}`,
      overlay: snapshot,
    });
    window.setTimeout(() => setUndo(null), UNDO_MS);
    if (turningOn) {
      setActive((index) =>
        nextUnverifiedIndex(
          rows.map((row) => ({
            verified: row.id === foodId ? true : row.verified_by_user,
            skipped: overlay[row.id]?.skipped === true,
          })),
          index,
          1,
        ),
      );
    }
  }, [activeRow, draft, overlay, persist, rows]);

  const skipActive = useCallback(async () => {
    if (!activeRow || !draft) return;
    await persist(activeRow, draft, { verified: activeRow.verified_by_user, skipped: true });
    const foodId = activeRow.id;
    setActive((index) =>
      nextUnverifiedIndex(
        rows.map((row) => ({
          verified: row.verified_by_user,
          skipped: row.id === foodId ? true : overlay[row.id]?.skipped === true,
        })),
        index,
        1,
      ),
    );
  }, [activeRow, draft, overlay, persist, rows]);

  const restoreOverlay = useCallback(
    (previous: Record<string, VerifyOverlayEntry>) => {
      replaceVerifyOverlay(previous);
      setOverlay(previous);
      setFoods((current) => current.map((food) => applyOverlayToFood(food, previous[food.id])));
      setUndo(null);
      void (async () => {
        for (const food of foods) {
          await cacheFoodWithServings(applyOverlayToFood(food, previous[food.id]), servings.get(food.id) ?? []);
        }
      })();
    },
    [foods, servings],
  );

  const applyBatch = useCallback(async () => {
    const snapshot = readVerifyOverlay();
    let next = snapshot;
    for (const food of batchRows) {
      const nextDraft = drafts[food.id] ?? draftFromFood(food);
      const entry = overlayFromFood(food, nextDraft, { verified: true, skipped: false }, next[food.id]);
      next = { ...next, [food.id]: entry };
    }
    replaceVerifyOverlay(next);
    setOverlay(next);
    setFoods((current) => current.map((food) => applyOverlayToFood(food, next[food.id])));
    for (const food of batchRows) {
      await cacheFoodWithServings(applyOverlayToFood(food, next[food.id]), servings.get(food.id) ?? []);
    }
    setBatchOpen(false);
    setUndo({
      message: `Verified ${batchRows.length} dishes`,
      overlay: snapshot,
    });
    window.setTimeout(() => setUndo(null), UNDO_MS);
  }, [batchRows, drafts, servings]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveActive();
        return;
      }
      if (typing) return;
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((index) => moveVerifyIndex(index, rows.length, 1));
        return;
      }
      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => moveVerifyIndex(index, rows.length, -1));
        return;
      }
      if (event.key === ']') {
        event.preventDefault();
        jumpUnverified(1);
        return;
      }
      if (event.key === '[') {
        event.preventDefault();
        jumpUnverified(-1);
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        jumpRef.current?.focus();
        jumpRef.current?.select();
        return;
      }
      if (event.key === 'Enter' || event.key === 'v') {
        event.preventDefault();
        void verifyActive();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jumpUnverified, rows.length, saveActive, verifyActive]);

  function updateDraft(patch: Partial<VerifyDraft>) {
    if (!activeRow || !draft) return;
    setDrafts((current) => ({ ...current, [activeRow.id]: { ...draft, ...patch } }));
  }

  const keys = [
    { key: 'j / k', label: 'move' },
    { key: 'Enter', label: 'verify' },
    { key: '⌘S', label: 'save' },
    { key: '] / [', label: 'next unverified' },
    { key: '/', label: 'jump' },
  ];

  return (
    <section className={`${styles.panel} ${styles.verify}`} aria-labelledby="verify-title" data-verify="">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>PH core · curation</p>
          <h1 id="verify-title" className={styles.title}>
            Verify
          </h1>
        </div>
        <div className={styles.verifyKeys}>
          {keys.map((item) => (
            <span key={item.key}>
              <kbd className={styles.k}>{item.key}</kbd>
              <span>{item.label}</span>
            </span>
          ))}
          <label className={styles.verifyJump}>
            <span className={styles.statLabel}>Jump</span>
            <input
              ref={jumpRef}
              type="search"
              value={jumpQuery}
              placeholder="kanin, adobo…"
              aria-label="Jump to a dish by name or alias"
              data-verify-jump=""
              onChange={(event) => {
                const next = event.currentTarget.value;
                setJumpQuery(next);
                const index = indexMatchingQuery(rows, next);
                if (index >= 0) setActive(index);
              }}
            />
          </label>
        </div>
      </header>

      <section className={styles.verifyProgress} aria-label="Verification progress">
        <div className={styles.verifyProgressTop}>
          <div>
            <div className={styles.verifyCountLine}>
              <span className={styles.verifyCount}>{verifiedCount}</span>
              <span className={styles.verifyOf}>of {rows.length || '—'}</span>
              <span className={styles.verifyCountLabel}>verified</span>
            </div>
            <p className={styles.verifyLede}>{verifyLede(verifiedCount, rows.length)}</p>
          </div>
          <div className={styles.verifyMeta}>
            <div>
              <p className={styles.statLabel}>4/4/9 drift</p>
              <p className={styles.verifyStat} data-warn={driftCount(rows) > 0 ? 'true' : 'false'}>
                {rows.length === 0 ? '—' : driftCount(rows)}
              </p>
            </div>
            <div>
              <p className={styles.statLabel}>Mean confidence</p>
              <p className={styles.verifyStat}>{meanConfidence(rows)}</p>
            </div>
            {batchRows.length > 0 ? (
              <button type="button" className={styles.verifyGhost} onClick={() => setBatchOpen(true)}>
                Batch verify {batchRows.length}
              </button>
            ) : null}
          </div>
        </div>
        <div className={styles.verifyCells} style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, 1fr)` }}>
          {rows.map((food, index) => {
            const skipped = overlay[food.id]?.skipped === true;
            const kind = food.verified_by_user
              ? 'verified'
              : index === active
                ? 'active'
                : skipped
                  ? 'skipped'
                  : 'idle';
            return (
              <button
                key={food.id}
                type="button"
                className={styles.verifyCell}
                data-verify-cell=""
                data-kind={kind}
                aria-label={`${food.name}${food.verified_by_user ? ', verified' : ''}`}
                title={food.name}
                aria-current={index === active ? 'true' : undefined}
                onClick={() => setActive(index)}
              />
            );
          })}
        </div>
      </section>

      {batchOpen ? (
        <div className={styles.verifyProposal}>
          <ProposalCard
            risk="medium"
            action="batch verify"
            title={`Mark ${batchRows.length} dishes verified`}
            why="These rows have 0% Atwater drift and confidence at or above 0.9. You have not opened each one."
            touches={['Verify', 'Foods']}
            foot="Past logs keep the snapshot they were saved with. This only changes the catalog going forward."
            diff={{
              before: `${batchRows.length} estimated`,
              after: `${batchRows.length} verified · confidence 1.00`,
            }}
            onApply={() => void applyBatch()}
            onEdit={() => {
              if (batchRows[0]) {
                const index = rows.findIndex((row) => row.id === batchRows[0]?.id);
                if (index >= 0) setActive(index);
              }
              setBatchOpen(false);
            }}
            onDismiss={() => setBatchOpen(false)}
          />
        </div>
      ) : null}

      <div className={styles.verifySplit}>
        <div className={styles.verifyTable} role="table" aria-label="PH core foods">
          <div className={styles.verifyCols} role="row">
            <span />
            <span>Dish · Taglish aliases</span>
            <span>P / C / F g</span>
            <span>kcal /100g</span>
            <span>Conf</span>
            <span>4/4/9</span>
          </div>
          <div className={styles.verifyBody}>
            {rows.map((food, index) => {
              const protein = Number(food.protein_g);
              const carbs = Number(food.carbs_g);
              const fat = Number(food.fat_g);
              const kcal = Number(food.kcal);
              const off = macrosOffByMoreThanFivePercent({ kcal, protein, carbs, fat });
              const verified = food.verified_by_user;
              return (
                <div
                  key={food.id}
                  role="row"
                  className={styles.verifyRow}
                  data-verify-row=""
                  data-active={index === active ? 'true' : 'false'}
                  data-verified={verified ? 'true' : 'false'}
                  onClick={() => setActive(index)}
                >
                  <span className={styles.mark} data-kind={verified ? 'verified' : 'plain'} aria-hidden="true">
                    {verified ? '✓' : '~'}
                  </span>
                  <span className={styles.verifyName}>
                    <strong>{food.name}</strong>
                    <span>{(food.name_tl ?? []).join(' · ') || '—'}</span>
                  </span>
                  <span className={styles.verifyPcf}>{pcfLabel(protein, carbs, fat)}</span>
                  <span className={styles.verifyKcal}>{Math.round(kcal).toLocaleString('en-PH')}</span>
                  <span className={styles.verifyConf}>{Number(food.confidence).toFixed(2)}</span>
                  <span className={styles.verifyFlag} data-off={off ? 'true' : 'false'}>
                    {off ? 'off >5%' : 'ok'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <aside className={styles.verifyInspector} data-dirty={dirty ? 'true' : 'false'}>
          {activeRow && draft && atwater ? (
            <>
              <div className={styles.verifyInspectorHead}>
                <p className={styles.statLabel}>
                  Row {rows.indexOf(activeRow) + 1} of {rows.length}
                  {dirty ? ' · unsaved' : ''}
                </p>
                <h2>{activeRow.name}</h2>
                <p>{(activeRow.name_tl ?? []).join(' · ') || '—'}</p>
              </div>
              <div className={styles.verifyInspectorBody}>
                <p className={styles.statLabel}>Per 100 g</p>
                <div className={styles.verifyMacros}>
                  {(
                    [
                      ['kcal', 'kcal', draft.kcal],
                      ['protein_g', 'Protein', draft.protein_g],
                      ['carbs_g', 'Carbs', draft.carbs_g],
                      ['fat_g', 'Fat', draft.fat_g],
                    ] as const
                  ).map(([key, label, value]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <input
                        value={value}
                        inputMode="decimal"
                        aria-label={`${label} per 100 g`}
                        onChange={(event) => updateDraft({ [key]: event.currentTarget.value })}
                      />
                    </label>
                  ))}
                </div>
                <div className={styles.verifyAtwater} data-off={atwater.reconciles ? 'false' : 'true'}>
                  <span className={styles.mark} data-kind={atwater.reconciles ? 'plain' : 'estimate'} aria-hidden="true">
                    {atwater.reconciles ? '=' : '!'}
                  </span>
                  <span>
                    <strong>{atwater.title}</strong>
                    <span data-atwater-detail="">{atwater.detail}</span>
                  </span>
                </div>
                <label className={styles.verifyField}>
                  <span>Default serving</span>
                  <input
                    readOnly
                    value={serving ? `${serving.label} · ${serving.grams_equivalent} g` : '—'}
                  />
                </label>
                <label className={styles.verifyField}>
                  <span>Source note · where the numbers came from</span>
                  <textarea
                    rows={4}
                    value={draft.source_note}
                    onChange={(event) => updateDraft({ source_note: event.currentTarget.value })}
                  />
                </label>
                <div className={styles.verifyActions}>
                  <button
                    type="button"
                    className={styles.verifyPrimary}
                    data-on={activeRow.verified_by_user ? 'true' : 'false'}
                    onClick={() => void verifyActive()}
                  >
                    {activeRow.verified_by_user ? 'Verified — undo' : 'Mark verified'}
                  </button>
                  <kbd className={styles.k}>⌘S</kbd>
                </div>
                <button type="button" className={styles.verifySkip} onClick={() => void skipActive()}>
                  Skip for later
                </button>
                <p className={styles.verifyFoot}>
                  Verifying raises confidence to 1.00 on this browser and this machine&apos;s Dexie
                  cache. It is not written to the server — another device, a cleared cache, or Android
                  still sees the catalog estimate until verify_ph_core_food exists.
                </p>
              </div>
            </>
          ) : (
            <p className={styles.note}>Pick a dish to inspect its numbers.</p>
          )}
        </aside>
      </div>

      {error ? (
        <p className={styles.note} role="alert">
          {error}
        </p>
      ) : null}

      {undo ? (
        <div className={styles.toastDock}>
          <Toast
            message={undo.message}
            action={
              <button type="button" onClick={() => restoreOverlay(undo.overlay)}>
                Undo
              </button>
            }
          />
        </div>
      ) : null}

      <DeskMusPane
        userId={userId}
        logicalDate={today}
        module="verify"
        view="ph_core"
        selectedIds={activeRow ? [activeRow.id] : []}
        selectionLabel={activeRow ? `${active + 1} · ${activeRow.name}` : undefined}
      />
    </section>
  );
}
