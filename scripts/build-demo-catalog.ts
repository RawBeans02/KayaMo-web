/**
 * Builds the seed catalog the no-account demo runs on.
 *
 * The `foods` table is `select ... to authenticated`, so an anonymous visitor
 * cannot read the catalog from Supabase. Rather than loosening that policy, the
 * demo ships the PH core dataset as a static JSON file and seeds it straight
 * into Dexie. Nothing about the demo touches the server.
 *
 *   pnpm demo:catalog:build
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPhCoreYaml } from '@kayamo/food/ph-core-io';

const OUT = resolve(process.cwd(), 'public/demo-catalog.json');

// Fixed so re-running the script does not churn Dexie rows for existing demos.
const SEEDED_AT = '2026-01-01T00:00:00.000Z';

/**
 * `food_entries.food_id` is a uuid, and the client guards on that shape
 * (`persistableFoodId`), so slug ids cannot be logged. Derive a stable UUIDv5
 * from each slug instead of random ones, so rebuilding the seed does not
 * orphan entries a demo user already logged.
 */
const DEMO_NAMESPACE = '6f9d1a3e-2c47-4b8a-9f10-5d3e7c81b204';

function uuidV5(name: string, namespace = DEMO_NAMESPACE): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(nsBytes).update(name, 'utf8').digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6); // version 5
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8); // RFC 4122 variant
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function main(): void {
  const { foods: source, issues } = loadPhCoreYaml();
  if (issues.length > 0) {
    for (const issue of issues) console.warn(`ph-core: ${JSON.stringify(issue)}`);
  }

  const foods = source.map((food) => ({
    id: uuidV5(food.id),
    source: 'ph_core',
    source_id: food.id,
    barcode: null,
    name: food.name,
    name_tl: food.name_tl,
    brand: null,
    kcal: String(food.per100g.kcal),
    protein_g: String(food.per100g.protein),
    carbs_g: String(food.per100g.carbs),
    fat_g: String(food.per100g.fat),
    fiber_g: String(food.per100g.fiber),
    sugar_g: String(food.per100g.sugar),
    sodium_mg: String(food.per100g.sodium_mg),
    confidence: String(food.confidence),
    source_note: food.source_note,
    verified_by_user: food.verified ?? false,
    shared: false,
    created_by: null,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
    deleted_at: null,
  }));

  const servings = source.flatMap((food) =>
    food.servings.map((serving, index) => ({
      id: uuidV5(`${food.id}#serving${index}`),
      food_id: uuidV5(food.id),
      label: serving.label,
      grams_equivalent: String(serving.grams),
      is_default: serving.is_default ?? index === 0,
      created_at: SEEDED_AT,
    })),
  );

  writeFileSync(OUT, `${JSON.stringify({ foods, servings }, null, 2)}\n`);
  console.log(`demo catalog: ${foods.length} foods, ${servings.length} servings -> ${OUT}`);
}

main();
