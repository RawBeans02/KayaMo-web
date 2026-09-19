import type { CatalogFood } from '@kayamo/food/search-ui';
import { foodRowToCatalog } from '@kayamo/food/search-ui';
import {
  createBrowserSupabase,
  listFoodAliases,
  listServingsByFoodIds,
  listVisibleFoods,
} from '@kayamo/db';
import { cacheFoodWithServings, listCachedFoodsWithServings } from '@kayamo/offline';
import { applyOverlayToFood } from './verify-model';
import { readVerifyOverlay } from './verify-overlay';

/** A row whose numbers came from this browser's overlay says so on the candidate. */
function flagLocalEdit<T extends CatalogFood>(row: T, edited: boolean): T {
  return edited ? { ...row, locallyEdited: true } : row;
}

export async function catalogFromCache(): Promise<CatalogFood[]> {
  const overlay = readVerifyOverlay();
  const cached = await listCachedFoodsWithServings();
  return cached.map(({ food, servings }) =>
    flagLocalEdit(
      foodRowToCatalog(applyOverlayToFood(food, overlay[food.id]), servings, food.name_tl ?? []),
      Boolean(overlay[food.id]),
    ),
  );
}

/**
 * Pulls visible foods into Dexie so Cmd+K / catalog screens share one cache.
 *
 * Only for a signed-in session. A guest has no session, so the request would go
 * out with the anon key and come back 401 from RLS on every Home and Lis visit
 * (Lighthouse counted it as a console error); the demo catalog is already in
 * Dexie, and the callers re-read the cache either way.
 */
export async function hydrateVisibleCatalog(): Promise<CatalogFood[]> {
  const client = createBrowserSupabase();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return [];
  const overlay = readVerifyOverlay();
  const rows = await listVisibleFoods(client);
  const ids = rows.map((row) => row.id);
  const [servingsById, aliases] = await Promise.all([
    listServingsByFoodIds(client, ids),
    listFoodAliases(client, ids),
  ]);
  for (const food of rows) {
    const patched = applyOverlayToFood(food, overlay[food.id]);
    await cacheFoodWithServings(patched, servingsById.get(food.id) ?? []);
  }
  return rows.map((food) =>
    flagLocalEdit(
      foodRowToCatalog(
        applyOverlayToFood(food, overlay[food.id]),
        servingsById.get(food.id) ?? [],
        aliases.get(food.id) ?? [],
      ),
      Boolean(overlay[food.id]),
    ),
  );
}
