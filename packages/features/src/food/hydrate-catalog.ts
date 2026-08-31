import type { CatalogFood } from '@kayamo/food/search-ui';
import { foodRowToCatalog } from '@kayamo/food/search-ui';
import {
  createBrowserSupabase,
  listFoodAliases,
  listServingsByFoodIds,
  listVisibleFoods,
} from '@kayamo/db';
import { cacheFoodWithServings, listCachedFoodsWithServings } from '@kayamo/offline';

export async function catalogFromCache(): Promise<CatalogFood[]> {
  const cached = await listCachedFoodsWithServings();
  return cached.map(({ food, servings }) =>
    foodRowToCatalog(food, servings, food.name_tl ?? []),
  );
}

/** Pulls visible foods into Dexie so Cmd+K / catalog screens share one cache. */
export async function hydrateVisibleCatalog(): Promise<CatalogFood[]> {
  const client = createBrowserSupabase();
  const rows = await listVisibleFoods(client);
  const ids = rows.map((row) => row.id);
  const [servingsById, aliases] = await Promise.all([
    listServingsByFoodIds(client, ids),
    listFoodAliases(client, ids),
  ]);
  for (const food of rows) {
    await cacheFoodWithServings(food, servingsById.get(food.id) ?? []);
  }
  return rows.map((food) =>
    foodRowToCatalog(
      food,
      servingsById.get(food.id) ?? [],
      aliases.get(food.id) ?? [],
    ),
  );
}
