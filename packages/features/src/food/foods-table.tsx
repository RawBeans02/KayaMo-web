'use client';

import type { Food } from '@kayamo/db';
import { createBrowserSupabase, listServingsByFoodIds, listVisibleFoods } from '@kayamo/db';
import { cacheFoodWithServings } from '@kayamo/offline';
import { useEffect, useMemo, useState } from 'react';
import { DeskMusPane } from '../desk/desk-mus';
import { useDeskClock } from '../desk/use-desk-clock';
import { ProvenanceKcal, ProvenanceMark } from './provenance';
import styles from './desk.module.css';

export function FoodsTable({ userId }: { userId: string }) {
  const { today } = useDeskClock(userId);
  const [foods, setFoods] = useState<Food[]>([]);
  const [servingLabel, setServingLabel] = useState<Map<string, string>>(new Map());
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserSupabase();
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listVisibleFoods(client);
        const servings = await listServingsByFoodIds(
          client,
          rows.map((row) => row.id),
        );
        for (const food of rows) {
          await cacheFoodWithServings(food, servings.get(food.id) ?? []);
        }
        if (cancelled) return;
        const labels = new Map<string, string>();
        for (const [id, list] of servings) {
          const picked = list.find((row) => row.is_default) ?? list[0];
          if (picked) labels.set(id, `${picked.label} · ${picked.grams_equivalent} g`);
        }
        setFoods(rows);
        setServingLabel(labels);
      } catch {
        if (!cancelled) setError('Could not load the catalog.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? foods.filter((food) => {
          const aliases = (food.name_tl ?? []).join(' ');
          return `${food.name} ${aliases}`.toLowerCase().includes(q);
        })
      : foods;
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [foods, query]);

  return (
    <section className={styles.panel} aria-labelledby="foods-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Catalog</p>
          <h1 id="foods-title" className={styles.title}>
            Foods
          </h1>
          <p className={styles.lede}>
            Everything visible under RLS. Logging happens in the command palette, not here.
          </p>
        </div>
      </header>
      <div className={styles.dashSplit}>
        <div className={styles.dashMain}>
      <label className={styles.search}>
        <span>Filter</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Adobo, kanin, sinaing…"
        />
      </label>
      {error ? (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      ) : null}
      {visible.length === 0 ? (
        <p className={styles.empty}>No foods match.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Aliases</th>
                <th scope="col">kcal / 100 g</th>
                <th scope="col">Default serving</th>
                <th scope="col">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((food) => (
                <tr key={food.id}>
                  <th scope="row" className={styles.wrap}>
                    {food.name}
                    <ProvenanceMark
                      source={food.source}
                      verified={food.verified_by_user}
                      estimate={food.source === 'llm'}
                    />
                  </th>
                  <td className={styles.wrap}>
                    <span className={styles.aliases}>{(food.name_tl ?? []).join(', ') || '—'}</span>
                  </td>
                  <td>
                    <ProvenanceKcal
                      kcal={food.kcal}
                      source={food.source}
                      verified={food.verified_by_user}
                      estimate={food.source === 'llm'}
                    />
                  </td>
                  <td>{servingLabel.get(food.id) ?? '—'}</td>
                  <td>{Number(food.confidence).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </div>
        <DeskMusPane userId={userId} logicalDate={today} module="foods" view="catalog" />
      </div>
    </section>
  );
}
