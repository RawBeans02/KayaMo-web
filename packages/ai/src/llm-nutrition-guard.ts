import { z } from 'zod';

/**
 * Keys an LLM must never emit on food-log / meal-photo extract paths.
 * Nutrition numbers come from @kayamo/food resolve — not from the model.
 * Label OCR is a different path: it copies digits off a printed panel.
 */
export const FORBIDDEN_LLM_NUTRITION_KEYS = [
  'kcal',
  'cal',
  'calories',
  'calorie',
  'kj',
  'energy_kcal',
  'protein_g',
  'carbs_g',
  'carbohydrate_g',
  'fat_g',
  'fiber_g',
  'sugar_g',
  'sodium_mg',
  'macros',
] as const;

const FORBIDDEN = new Set<string>(FORBIDDEN_LLM_NUTRITION_KEYS);

function walkJsonSchema(node: unknown, found: string[]): void {
  if (!node || typeof node !== 'object') return;
  const rec = node as Record<string, unknown>;
  if (rec.properties && typeof rec.properties === 'object' && rec.properties !== null) {
    for (const [key, child] of Object.entries(rec.properties as Record<string, unknown>)) {
      if (FORBIDDEN.has(key.toLowerCase())) found.push(key);
      walkJsonSchema(child, found);
    }
  }
  if ('items' in rec) walkJsonSchema(rec.items, found);
  for (const combo of ['anyOf', 'oneOf', 'allOf'] as const) {
    const options = rec[combo];
    if (Array.isArray(options)) {
      for (const option of options) walkJsonSchema(option, found);
    }
  }
  if (rec.$defs && typeof rec.$defs === 'object') {
    for (const def of Object.values(rec.$defs)) walkJsonSchema(def, found);
  }
  if (rec.definitions && typeof rec.definitions === 'object') {
    for (const def of Object.values(rec.definitions)) walkJsonSchema(def, found);
  }
}

export function nutritionKeysInJsonSchema(schema: unknown): string[] {
  const found: string[] = [];
  walkJsonSchema(schema, found);
  return [...new Set(found)];
}

export function nutritionKeysInZod(schema: z.ZodType): string[] {
  // The guard cares about what the model may emit, which is the schema's
  // input side. The output side is what a `.transform()` produces, and Zod
  // refuses to represent transforms there, so the chat schema used to make
  // this throw. Unrepresentable pieces become `{}` rather than aborting the
  // walk; a guard that crashes is a guard that gets removed.
  return nutritionKeysInJsonSchema(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }));
}
