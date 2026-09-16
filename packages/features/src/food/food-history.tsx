'use client';

import { createBrowserSupabase } from '@kayamo/db';
import { asMealSlot, mealSlotLabel, orderedMealSlots, type MealSlot } from '@kayamo/food/quick-log';
import { useDeskLocale } from '../i18n/desk-locale';
import {
  logicalDateFromInstant,
  useLiveFoodHistory,
  type LocalFoodEntry,
} from '@kayamo/offline';
import { useEffect, useMemo, useState } from 'react';
import { filterFoodHistory, foodHistorySince, type FoodHistoryRange } from './filter-food-history';
import { DEFAULT_FOOD_HISTORY_DAYS, hydrateFoodHistory } from './hydrate-food-history';
import styles from './food-history.module.css';

export const FOOD_HISTORY_FILTER_ID = 'food-history-filter';

export function FoodHistory({ userId }: { userId: string }) {
  const locale = useDeskLocale();
  const rows = useLiveFoodHistory(userId);
  const [range, setRange] = useState<FoodHistoryRange>('week');
  const [slot, setSlot] = useState<MealSlot | 'all'>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [clock, setClock] = useState({ timeZone: 'Asia/Manila', dayStartsAt: '00:00:00' });

  useEffect(() => {
    let cancelled = false;
    const client = createBrowserSupabase();
    void hydrateFoodHistory({
      client,
      userId,
      historyDays: DEFAULT_FOOD_HISTORY_DAYS,
    })
      .then((next) => {
        if (cancelled) return;
        setClock(next);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('offline');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const todayLogical = logicalDateFromInstant(new Date().toISOString(), clock.timeZone, clock.dayStartsAt);
  const since = foodHistorySince(todayLogical, range);
  const visible = useMemo(
    () => filterFoodHistory(rows, { query, slot, since }),
    [query, rows, since, slot],
  );

  return (
    <section className={styles.panel} aria-labelledby="food-history-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Physical Self</p>
          <h1 id="food-history-title">Food history</h1>
          <p className={styles.lede}>
            Entries you confirmed on any device. This view hydrates from your account, then stays on this
            browser until you reconnect.
          </p>
        </div>
        <p className={styles.status} role="status">
          {status === 'loading' ? 'Loading from your account…' : null}
          {status === 'offline' ? 'Showing what is already on this device. Reconnect to pull the rest.' : null}
          {status === 'ready' ? `${visible.length} in this window` : null}
        </p>
      </header>
      <div className={styles.filters}>
        <label className={styles.search}>
          <span>Filter by name</span>
          <input
            id={FOOD_HISTORY_FILTER_ID}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your logged foods…"
          />
        </label>
        <fieldset className={styles.range}>
          <legend>Window</legend>
          {(
            [
              ['week', 'This week'],
              ['month', '30 days'],
              ['all', 'Hydrated'],
            ] as const
          ).map(([id, label]) => (
            <label key={id}>
              <input
                type="radio"
                name="food-history-range"
                checked={range === id}
                onChange={() => setRange(id)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className={styles.slot}>
          <span>Meal</span>
          <select value={slot} onChange={(event) => setSlot(event.target.value as MealSlot | 'all')}>
            <option value="all">All meals</option>
            {orderedMealSlots().map((id) => (
              <option key={id} value={id}>
                {mealSlotLabel(id, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {visible.length === 0 ? (
        <p className={styles.empty}>
          {status === 'loading'
            ? 'Pulling confirmed meals…'
            : 'Nothing in this window. Log on your phone, then refresh here.'}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Meal</th>
                <th scope="col">Food</th>
                <th scope="col">kcal</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <FoodHistoryRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FoodHistoryRow({ row }: { row: LocalFoodEntry }) {
  const locale = useDeskLocale();
  const slot = asMealSlot(row.meal_slot);
  return (
    <tr>
      <th scope="row">
        {row.logical_date}
        <small>{row.logged_at.slice(11, 16)} UTC</small>
      </th>
      <td>{slot ? mealSlotLabel(slot, locale) : row.meal_slot}</td>
      <td>
        <strong>{row.food_name_snapshot}</strong>
        <small>{row.serving_label_snapshot ?? `${row.grams} g`}</small>
      </td>
      <td>{Math.round(Number(row.kcal))}</td>
      <td>
        {row.source}
        <small>{Math.round(Number(row.confidence) * 100)}%</small>
      </td>
    </tr>
  );
}
