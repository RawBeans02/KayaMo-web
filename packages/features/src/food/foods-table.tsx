'use client';
import type { ReactNode } from 'react';

import type { Food, Serving } from '@kayamo/db';
import {
  createBrowserSupabase,
  insertFoodAliases,
  insertServings,
  insertUserFood,
  listFoodAliases,
  listServingsByFoodIds,
  listVisibleFoods,
  tombstoneUserFood,
} from '@kayamo/db';
import {
  cacheFoodWithServings,
  listCachedFoodsWithServings,
  recoverClosedOfflineDb,
} from '@kayamo/offline';
import { ProposalCard, Toast } from '@kayamo/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeskMusPane } from '../desk/desk-mus';
import { useDeskClock } from '../desk/use-desk-clock';
import {
  catalogBadge,
  catalogShape,
  filterCatalog,
  foodsCountLabel,
  kcalCell,
  provenanceLabel,
  uniqueAliases,
  type CatalogSourceFilter,
} from './foods-model';
import { applyOverlayToFood } from './verify-model';
import { readVerifyOverlay } from './verify-overlay';
import { waitForUserDb } from './wait-user-db';
import styles from './desk.module.css';

const UNDO_MS = 8000;

function defaultServing(list: Serving[] | undefined): Serving | null {
  if (!list || list.length === 0) return null;
  return list.find((row) => row.is_default) ?? list[0] ?? null;
}

export function FoodsTable({ userId, children }: { userId: string; children?: ReactNode }) {
  const { today } = useDeskClock(userId);
  const [foods, setFoods] = useState<Food[]>([]);
  const [servings, setServings] = useState<Map<string, Serving[]>>(new Map());
  const [aliases, setAliases] = useState<Map<string, string[]>>(new Map());
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<CatalogSourceFilter>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createKcal, setCreateKcal] = useState('');
  const [createProtein, setCreateProtein] = useState('');
  const [createCarbs, setCreateCarbs] = useState('');
  const [createFat, setCreateFat] = useState('');
  const [createServing, setCreateServing] = useState('1 serving');
  const [createGrams, setCreateGrams] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ message: string; run: () => Promise<void> } | null>(null);

  const paint = useCallback((rows: Food[], nextServings: Map<string, Serving[]>, nextAliases: Map<string, string[]>) => {
    const overlay = readVerifyOverlay();
    setFoods(rows.map((food) => applyOverlayToFood(food, overlay[food.id])));
    setServings(nextServings);
    setAliases(nextAliases);
  }, []);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    const isCancelled = () => cancelled;
    void (async () => {
      await waitForUserDb(userId, isCancelled);
      if (cancelled) return;
      const overlay = readVerifyOverlay();
      let cachedCount = 0;
      try {
        const cached = await recoverClosedOfflineDb(() => listCachedFoodsWithServings());
        cachedCount = cached.length;
        if (!cancelled && cached.length > 0) {
          setServings(new Map(cached.map((row) => [row.food.id, row.servings])));
          setFoods(cached.map((row) => applyOverlayToFood(row.food, overlay[row.food.id])));
        }
      } catch {
        /* Network pull still runs. */
      }
      try {
        const rows = await listVisibleFoods(client);
        const ids = rows.map((row) => row.id);
        const [byId, aliasMap] = await Promise.all([
          listServingsByFoodIds(client, ids),
          listFoodAliases(client, ids),
        ]);
        for (const food of rows) {
          await cacheFoodWithServings(applyOverlayToFood(food, overlay[food.id]), byId.get(food.id) ?? []);
        }
        // A remote result is not a deletion manifest for the offline catalog.
        // Read back the account-scoped cache so offline-only foods and servings
        // survive empty/partial refreshes; cached tombstones stay excluded.
        const cached = await recoverClosedOfflineDb(() => listCachedFoodsWithServings());
        if (cancelled) return;
        paint(
          cached.map(({ food }) => food),
          new Map(cached.map(({ food, servings: list }) => [food.id, list])),
          aliasMap,
        );
        setError(null);
      } catch {
        if (!cancelled && cachedCount === 0) setError('Could not load the catalog.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paint, userId]);

  const visible = useMemo(() => {
    const filtered = filterCatalog(foods, query, source, aliases);
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [aliases, foods, query, source]);

  const shape = useMemo(() => catalogShape(foods), [foods]);
  const activeRow = visible.find((food) => food.id === activeId) ?? visible[0] ?? null;
  const serving = activeRow ? defaultServing(servings.get(activeRow.id)) : null;
  const activeAliases = activeRow
    ? uniqueAliases(activeRow.name_tl, aliases.get(activeRow.id))
    : [];
  const mergeTarget = foods.find((food) => food.id === mergeTargetId) ?? null;

  async function addAlias(food: Food, alias: string) {
    const trimmed = alias.trim();
    if (!trimmed) return;
    const client = createBrowserSupabase();
    try {
      await insertFoodAliases(client, [
        { food_id: food.id, alias: trimmed, updated_at: new Date().toISOString() },
      ]);
      setAliases((current) => {
        const next = new Map(current);
        next.set(food.id, uniqueAliases(next.get(food.id), [trimmed]));
        return next;
      });
      setAliasDraft('');
      setUndo({
        message: `Added alias “${trimmed}”`,
        run: async () => undefined,
      });
      window.setTimeout(() => setUndo(null), UNDO_MS);
    } catch {
      setError(
        food.source === 'user'
          ? 'Could not save that alias.'
          : 'PH-core aliases need verify_ph_core_food, the same RPC as Verify. This browser cannot write the shared catalog.',
      );
    }
  }

  async function createFood() {
    const name = createName.trim();
    if (!name) return;
    const client = createBrowserSupabase();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    try {
      const food = await insertUserFood(client, {
        id,
        name,
        name_tl: [],
        kcal: createKcal || '0',
        protein_g: createProtein || '0',
        carbs_g: createCarbs || '0',
        fat_g: createFat || '0',
        fiber_g: '0',
        sugar_g: '0',
        sodium_mg: '0',
        confidence: '1.00',
        verified_by_user: true,
        created_by: userId,
        shared: false,
        source_note: 'Created on the Foods desk',
        updated_at: now,
      });
      const servingRows = await insertServings(client, [
        {
          food_id: food.id,
          label: createServing.trim() || '1 serving',
          grams_equivalent: createGrams || '100',
          is_default: true,
          updated_at: now,
        },
      ]);
      await cacheFoodWithServings(food, servingRows);
      setFoods((current) => [...current, food]);
      setServings((current) => new Map(current).set(food.id, servingRows));
      setCreating(false);
      setActiveId(food.id);
      setCreateName('');
      setUndo({
        message: `Created ${food.name}`,
        run: async () => {
          await tombstoneUserFood(client, { id: food.id, updatedAt: new Date().toISOString() });
          setFoods((current) => current.filter((row) => row.id !== food.id));
        },
      });
      window.setTimeout(() => setUndo(null), UNDO_MS);
    } catch {
      setError('Could not create that food.');
    }
  }

  async function applyMerge() {
    if (!activeRow || !mergeTarget || mergeTarget.id === activeRow.id) return;
    await addAlias(mergeTarget, activeRow.name);
    setMergeOpen(false);
  }

  return (
    <section className={`${styles.panel} ${styles.foods}`} aria-labelledby="foods-title" data-foods="">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Catalog · {foods.length} foods</p>
          <h1 id="foods-title" className={styles.title}>
            Foods
          </h1>
        </div>
        <p className={styles.foodsLede}>Your saved catalog. Log a saved food from the palette, or search worldwide below.</p>
      </header>
      {children}

      <section className={styles.foodsShape} aria-label="Shape of the database">
        <p className={styles.statLabel}>Shape of the database</p>
        <div className={styles.foodsBar}>
          {shape.map((slice) => (
            <span
              key={slice.source}
              style={{ width: slice.width, background: slice.token }}
              title={`${slice.label} ${slice.count}`}
            />
          ))}
        </div>
        <div className={styles.foodsLegend}>
          {shape.map((slice) => (
            <span key={slice.source} className={styles.foodsLegendItem}>
              <span className={styles.foodsSwatch} style={{ background: slice.token }} />
              <span>{slice.label}</span>
              <span className={styles.foodsLegendCount}>{slice.count}</span>
              <span className={styles.foodsLegendSub}>{slice.sub}</span>
            </span>
          ))}
        </div>
      </section>

      <div className={styles.verifySplit}>
        <div>
          <div className={styles.foodsToolbar}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Filter by name or alias…"
              aria-label="Filter by name or alias"
            />
            <div className={styles.foodsPills}>
              <button
                type="button"
                className={styles.foodsPill}
                data-on={source === 'all' ? 'true' : 'false'}
                onClick={() => setSource('all')}
              >
                <span>All</span>
                <span className={styles.foodsPillCount}>{foods.length}</span>
              </button>
              {shape.map((slice) => (
                <button
                  key={slice.source}
                  type="button"
                  className={styles.foodsPill}
                  data-on={source === slice.source ? 'true' : 'false'}
                  onClick={() => setSource(slice.source)}
                >
                  <span>{slice.label}</span>
                  <span className={styles.foodsPillCount}>{slice.count}</span>
                </button>
              ))}
            </div>
            <span className={styles.foodsCount}>{foodsCountLabel(visible.length, foods.length)}</span>
            <button type="button" className={styles.verifyGhost} onClick={() => setCreating(true)}>
              New food
            </button>
          </div>

          {error ? (
            <p className={styles.note} role="alert">
              {error}
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className={styles.empty}>No foods match.</p>
          ) : (
            <div className={styles.foodsGrid} role="table" aria-label="Catalog foods">
              <div className={styles.foodsCols} role="row">
                <span role="columnheader" aria-label="Verification" />
                <span role="columnheader">Dish · aliases</span>
                <span role="columnheader">Source</span>
                <span role="columnheader">kcal /100g</span>
                <span role="columnheader">Default serving</span>
                <span role="columnheader">Conf</span>
              </div>
              <div className={styles.foodsBody}>
                {visible.map((food) => {
                  const list = uniqueAliases(food.name_tl, aliases.get(food.id));
                  const mark = food.source === 'llm' ? '~' : food.verified_by_user ? '✓' : '~';
                  return (
                    <div
                      key={food.id}
                      role="row"
                      className={styles.foodsRow}
                      data-foods-row=""
                      data-source={food.source}
                      data-active={food.id === activeRow?.id ? 'true' : 'false'}
                      onClick={() => {
                        setActiveId(food.id);
                        setCreating(false);
                      }}
                    >
                      <span role="cell" className={styles.mark} data-kind={food.verified_by_user ? 'verified' : 'plain'} aria-label={food.verified_by_user ? 'Verified' : 'Unverified'}>
                        {mark}
                      </span>
                      <span role="cell" className={styles.foodsName}>
                        <button type="button" data-food-select=""><strong>{food.name}</strong></button>
                        <span>{list.join(' · ') || '—'}</span>
                      </span>
                      <span role="cell" className={styles.foodsProv}>
                        <span className={styles.foodsBadge} data-source={food.source}>
                          {catalogBadge(food.source)}
                        </span>
                        <span>{provenanceLabel(food.source, food.verified_by_user)}</span>
                      </span>
                      <span role="cell" className={styles.foodsKcal} data-kcal-cell="">
                        {kcalCell(food)}
                        <span className={styles.foodsKcalUnit}>/100g</span>
                      </span>
                      <span role="cell" className={styles.foodsServing}>
                        {(() => {
                          const picked = defaultServing(servings.get(food.id));
                          return picked ? `${picked.label} · ${picked.grams_equivalent} g` : '—';
                        })()}
                      </span>
                      <span role="cell" className={styles.foodsConf}>
                        {food.source === 'llm' ? '—' : Number(food.confidence).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <aside className={styles.verifyInspector} data-foods-inspector="">
          {creating ? (
            <div className={styles.verifyInspectorBody}>
              <p className={styles.statLabel}>Create · yours</p>
              <h2>New food</h2>
              <label className={styles.verifyField}>
                <span>Name</span>
                <input value={createName} onChange={(event) => setCreateName(event.currentTarget.value)} />
              </label>
              <div className={styles.verifyMacros}>
                {(
                  [
                    ['kcal', createKcal, setCreateKcal],
                    ['Protein', createProtein, setCreateProtein],
                    ['Carbs', createCarbs, setCreateCarbs],
                    ['Fat', createFat, setCreateFat],
                  ] as const
                ).map(([label, value, setValue]) => (
                  <label key={label}>
                    <span>{label}</span>
                    <input value={value} inputMode="decimal" onChange={(event) => setValue(event.currentTarget.value)} />
                  </label>
                ))}
              </div>
              <label className={styles.verifyField}>
                <span>Default serving</span>
                <input value={createServing} onChange={(event) => setCreateServing(event.currentTarget.value)} />
              </label>
              <label className={styles.verifyField}>
                <span>Grams</span>
                <input value={createGrams} inputMode="decimal" onChange={(event) => setCreateGrams(event.currentTarget.value)} />
              </label>
              <div className={styles.verifyActions}>
                <button type="button" className={styles.verifyPrimary} onClick={() => void createFood()}>
                  Save food
                </button>
                <button type="button" className={styles.verifySkip} onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : activeRow ? (
            <>
              <div className={styles.verifyInspectorHead}>
                <p className={styles.statLabel}>
                  {catalogBadge(activeRow.source)} · {provenanceLabel(activeRow.source, activeRow.verified_by_user)}
                </p>
                <h2>{activeRow.name}</h2>
                <p>{activeAliases.join(' · ') || '—'}</p>
              </div>
              <div className={styles.verifyInspectorBody}>
                <p className={styles.statLabel}>Per 100 g</p>
                <p className={styles.foodsKcal} data-foods-kcal="">
                  {kcalCell(activeRow)}
                  <span className={styles.foodsKcalUnit}>kcal</span>
                </p>
                <p className={styles.note}>
                  {activeRow.protein_g} P · {activeRow.carbs_g} C · {activeRow.fat_g} F
                </p>
                <label className={styles.verifyField}>
                  <span>Default serving</span>
                  <input
                    readOnly
                    value={serving ? `${serving.label} · ${serving.grams_equivalent} g` : '—'}
                  />
                </label>
                <label className={styles.verifyField}>
                  <span>Source note</span>
                  <textarea readOnly rows={4} value={activeRow.source_note ?? ''} />
                </label>
                <label className={styles.verifyField}>
                  <span>Add alias</span>
                  <input
                    value={aliasDraft}
                    placeholder="sinaing"
                    onChange={(event) => setAliasDraft(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void addAlias(activeRow, aliasDraft);
                      }
                    }}
                  />
                </label>
                <button type="button" className={styles.verifySkip} onClick={() => void addAlias(activeRow, aliasDraft)}>
                  Add alias
                </button>
                <label className={styles.verifyField}>
                  <span>Fold this name into</span>
                  <select
                    value={mergeTargetId}
                    onChange={(event) => setMergeTargetId(event.currentTarget.value)}
                  >
                    <option value="">Choose a food…</option>
                    {foods
                      .filter((food) => food.id !== activeRow.id)
                      .map((food) => (
                        <option key={food.id} value={food.id}>
                          {food.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.verifyGhost}
                  disabled={!mergeTargetId}
                  onClick={() => setMergeOpen(true)}
                >
                  Merge as alias
                </button>
                {activeRow.source === 'ph_core' ? (
                  <p className={styles.verifyFoot}>
                    Numbers for PH core are edited on Verify. Alias and merge writes to the shared
                    table need the same RPC; until then they only land on user-created foods.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className={styles.note}>Pick a food, or create one that is yours.</p>
          )}
        </aside>
      </div>

      {mergeOpen && activeRow && mergeTarget ? (
        <div className={styles.verifyProposal}>
          <ProposalCard
            risk="medium"
            action="add alias"
            title={`Fold “${activeRow.name}” into ${mergeTarget.name}`}
            why="The current name becomes an alias on the target. Past logs keep the snapshot they were saved with."
            touches={['Foods', '⌘K']}
            foot="This does not delete the current row."
            diff={{
              before: activeRow.name,
              after: `${mergeTarget.name} + alias ${activeRow.name}`,
            }}
            onApply={() => void applyMerge()}
            onEdit={() => setMergeOpen(false)}
            onDismiss={() => setMergeOpen(false)}
          />
        </div>
      ) : null}

      {undo ? (
        <div className={styles.toastDock}>
          <Toast
            message={undo.message}
            action={
              <button type="button" onClick={() => void undo.run().then(() => setUndo(null))}>
                Undo
              </button>
            }
          />
        </div>
      ) : null}

      <DeskMusPane
        userId={userId}
        logicalDate={today}
        module="foods"
        view="catalog"
        selectedIds={activeRow ? [activeRow.id] : []}
        selectionLabel={activeRow?.name}
      />
    </section>
  );
}
