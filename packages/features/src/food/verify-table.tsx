'use client';

import type { Food, Serving } from '@kayamo/db';
import { createBrowserSupabase, listServingsByFoodIds, listVisibleFoods } from '@kayamo/db';
import { logCountsFromHistory, type SearchHistoryEntry } from '@kayamo/food/search-ui';
import { cacheFoodWithServings, useLiveFoodHistory } from '@kayamo/offline';
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { macrosOffByMoreThanFivePercent } from './atwater-check';
import { ProvenanceKcal } from './provenance';
import { moveVerifyIndex, sortVerifyRows } from './verify-rows';
import { DeskMusPane } from '../desk/desk-mus';
import { useDeskClock } from '../desk/use-desk-clock';
import styles from './desk.module.css';

const WRITE_BLOCKED =
  'Saving waits on a catalog grant. ph_core rows are not writable under current RLS.';

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
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const historyRows = useLiveFoodHistory(userId);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    void (async () => {
      try {
        const rows = (await listVisibleFoods(client)).filter((food) => food.source === 'ph_core');
        const byId = await listServingsByFoodIds(
          client,
          rows.map((row) => row.id),
        );
        for (const food of rows) {
          await cacheFoodWithServings(food, byId.get(food.id) ?? []);
        }
        if (cancelled) return;
        setFoods(rows);
        setServings(byId);
      } catch {
        if (!cancelled) setError('Could not load PH core foods.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logCounts = useMemo(() => {
    const history = historyRows.flatMap((row) => toHistory(row) ?? []);
    return logCountsFromHistory(history);
  }, [historyRows]);

  const rows = useMemo(() => sortVerifyRows(foods, logCounts), [foods, logCounts]);

  function onKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
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
    if (event.key === 'Enter' || event.key === 'v' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's')) {
      event.preventDefault();
      setStatus(WRITE_BLOCKED);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="verify-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>PH core</p>
          <h1 id="verify-title" className={styles.title}>
            Verify
          </h1>
          <p className={styles.lede}>
            {rows.length} dishes. <span className={styles.k}>j</span>/<span className={styles.k}>k</span>{' '}
            move. Writes are disabled until the catalog grant lands — this sitting still shows
            4/4/9 drift so you can see what needs a look.
          </p>
        </div>
      </header>

      <div className={styles.dashSplit}>
        <div className={styles.dashMain}>
      <p className={styles.note} role="status">
        {status ?? `${rows.length} rows · sorted by how often you have logged them`}
      </p>
      {error ? (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.tableWrap} tabIndex={0} onKeyDown={onKey} aria-label="PH core foods">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">name_tl</th>
              <th scope="col">P / C / F</th>
              <th scope="col">kcal / 100 g</th>
              <th scope="col">Default serving</th>
              <th scope="col">Conf.</th>
              <th scope="col">4/4/9</th>
              <th scope="col">source_note</th>
              <th scope="col">Verify</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((food, index) => {
              const serving = defaultServing(servings.get(food.id));
              const protein = Number(food.protein_g);
              const carbs = Number(food.carbs_g);
              const fat = Number(food.fat_g);
              const kcal = Number(food.kcal);
              const off = macrosOffByMoreThanFivePercent({
                kcal,
                protein,
                carbs,
                fat,
              });
              return (
                <tr
                  key={food.id}
                  data-active={index === active ? 'true' : 'false'}
                  onClick={() => setActive(index)}
                >
                  <th scope="row" className={styles.wrap}>
                    {food.name}
                  </th>
                  <td className={styles.wrap}>
                    <span className={styles.aliases}>{(food.name_tl ?? []).join(', ')}</span>
                  </td>
                  <td>
                    {protein.toFixed(1)} / {carbs.toFixed(1)} / {fat.toFixed(1)}
                  </td>
                  <td>
                    <ProvenanceKcal
                      kcal={food.kcal}
                      source={food.source}
                      verified={food.verified_by_user}
                      estimate={false}
                    />
                  </td>
                  <td>
                    {serving
                      ? `${serving.label} · ${serving.grams_equivalent} g`
                      : '—'}
                  </td>
                  <td>{Number(food.confidence).toFixed(2)}</td>
                  <td>
                    <span className={styles.flag} data-off={off ? 'true' : 'false'}>
                      {off ? 'off >5%' : 'ok'}
                    </span>
                  </td>
                  <td className={styles.noteCell} title={food.source_note ?? undefined}>
                    {food.source_note ?? '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled
                      title={WRITE_BLOCKED}
                      onClick={() => setStatus(WRITE_BLOCKED)}
                    >
                      Verify
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        </div>
        <DeskMusPane
          userId={userId}
          logicalDate={today}
          module="verify"
          view="ph_core"
          selectedIds={rows[active]?.id ? [rows[active].id] : []}
        />
      </div>
    </section>
  );
}
