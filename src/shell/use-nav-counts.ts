'use client';

// Deliberately NOT via '@kayamo/features/desktop': that entry is imported by
// server components, and this module's transitive @kayamo/offline import pulls
// React hooks into the server graph. This subpath is only ever imported here,
// from a client module.
import { catalogFromCache } from '@kayamo/features/food-catalog';
import { listLocalOpenTasks } from '@kayamo/offline';
import { useEffect, useState } from 'react';

/**
 * Per-section counts for the sidebar rail.
 *
 * The design puts a count on Foods, Verify and Todos only — Today, Gym and Lis
 * carry an empty string, so their track collapses. Anything that cannot be read
 * yet stays null and renders nothing rather than a misleading zero.
 */
export type NavCounts = {
  foods: string | null;
  verify: string | null;
  todos: string | null;
};

const EMPTY: NavCounts = { foods: null, verify: null, todos: null };

export function useNavCounts(userId: string): NavCounts {
  const [counts, setCounts] = useState<NavCounts>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const next: NavCounts = { ...EMPTY };

      try {
        const catalog = await catalogFromCache();
        if (catalog.length > 0) {
          next.foods = String(catalog.length);
          // Verify curates PH core only, so its denominator is that subset —
          // not the whole catalog, which includes brand and USDA rows.
          const phCore = catalog.filter((food) => food.source === 'ph_core');
          if (phCore.length > 0) {
            const verified = phCore.filter((food) => food.verified === true).length;
            next.verify = `${verified}/${phCore.length}`;
          }
        }
      } catch {
        // Dexie not ready yet; leave both null.
      }

      try {
        const open = await listLocalOpenTasks(userId);
        if (open.length > 0) next.todos = String(open.length);
      } catch {
        // Same — a missing count is better than a wrong one.
      }

      if (!cancelled) setCounts(next);
    }

    void read();
    // The catalog and task tables change from other surfaces (⌘K, Verify,
    // Todos), so re-read on a slow interval rather than holding a live query
    // open for a label this small.
    const tick = window.setInterval(() => void read(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [userId]);

  return counts;
}
