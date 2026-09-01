import { foodParseSchema } from '@kayamo/food';
import { z } from 'zod';

/**
 * Chapter 14 contract: the cheap model extracts text and quantities only.
 * Register every LLM food-logging schema here so CI fails if kcal/macros sneak in
 * before the pipeline is wired.
 */

export const foodExtractItemSchema = z.object({
  raw_text: z.string().min(1),
  food_name_guess: z.string().min(1),
  food_name_en: z.string().min(1).optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  meal_slot_guess: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
});

export const foodExtractAmbiguitySchema = z.object({
  item_index: z.number().int().nonnegative(),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
});

export const foodExtractSchema = z.object({
  items: z.array(foodExtractItemSchema),
  ambiguities: z.array(foodExtractAmbiguitySchema),
});

export type FoodExtractItem = z.infer<typeof foodExtractItemSchema>;
export type FoodExtractAmbiguity = z.infer<typeof foodExtractAmbiguitySchema>;
export type FoodExtract = z.infer<typeof foodExtractSchema>;

/** Schemas the model may emit for NL food logging. Nutrition numbers are forbidden. */
export const LLM_FOOD_LOGGING_SCHEMAS = [foodExtractSchema, foodParseSchema] as const;
