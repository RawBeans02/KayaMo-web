'use client';

import type { Food, Serving } from '@kayamo/db';
import { getOfflineDb, getOfflineScope } from '@kayamo/offline';
import { z } from 'zod';

const amount = z.string().refine((value) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0);
const foodSchema = z.object({
  id: z.string().uuid(), source: z.literal('ph_core'), source_id: z.string().min(1),
  name: z.string().min(1), name_tl: z.array(z.string()),
  barcode: z.null(), brand: z.null(),
  kcal: amount, protein_g: amount, carbs_g: amount, fat_g: amount,
  fiber_g: amount, sugar_g: amount, sodium_mg: amount,
  confidence: amount.refine((value) => Number(value) <= 1),
  source_note: z.string().nullable(), verified_by_user: z.boolean(),
  shared: z.literal(false), created_by: z.null(), deleted_at: z.null(),
  created_at: z.string().datetime(), updated_at: z.string().datetime(),
});
const servingSchema = z.object({
  id: z.string().uuid(), food_id: z.string().uuid(), label: z.string().min(1),
  grams_equivalent: amount.refine((value) => Number(value) > 0),
  is_default: z.boolean(), created_at: z.string().datetime(),
});
const schema = z.object({ foods: z.array(foodSchema).min(1), servings: z.array(servingSchema).min(1) });

export function parseDemoCatalog(value: unknown): { foods: Food[]; servings: Serving[] } {
  const catalog = schema.parse(value);
  const ids = new Set(catalog.foods.map((row) => row.id));
  if (ids.size !== catalog.foods.length ||
      new Set(catalog.servings.map((row) => row.id)).size !== catalog.servings.length ||
      catalog.servings.some((row) => !ids.has(row.food_id))) {
    throw new Error('Invalid catalog references');
  }
  return {
    foods: catalog.foods.map((row) => ({ ...row, attribution: null, server_updated_at: row.updated_at })),
    servings: catalog.servings.map((row) => ({ ...row, updated_at: row.created_at, server_updated_at: row.created_at })),
  };
}

/** Validate first, then atomically repair/install the entire public catalog. Never deletes user entries. */
export async function installDemoCatalog(guestId: string, value: unknown): Promise<void> {
  if (!/^guest-[0-9a-f]{32}$/.test(guestId) || getOfflineScope().userId !== guestId) {
    throw new Error('Demo scope changed');
  }
  const catalog = parseDemoCatalog(value);
  const db = getOfflineDb();
  await db.transaction('rw', db.foods, db.servings, async () => {
    if (getOfflineScope().userId !== guestId) throw new Error('Demo scope changed');
    await db.foods.bulkPut(catalog.foods);
    await db.servings.bulkPut(catalog.servings);
  });
}
