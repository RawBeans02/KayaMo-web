import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { nutritionLabelOcrSchema } from '@kayamo/food/label-ocr';
import { foodExtractSchema, LLM_FOOD_LOGGING_SCHEMAS } from './food-extract';
import { nutritionKeysInZod } from './llm-nutrition-guard';

describe('LLM food-logging schemas', () => {
  it('do not include nutrition number fields — resolver supplies those', () => {
    for (const schema of LLM_FOOD_LOGGING_SCHEMAS) {
      expect(nutritionKeysInZod(schema)).toEqual([]);
    }
    expect(nutritionKeysInZod(foodExtractSchema)).toEqual([]);
  });

  it('detects kcal nested on an extract-shaped schema so ch14 cannot land it by accident', () => {
    const leaking = z.object({
      items: z.array(
        z.object({
          raw_text: z.string(),
          kcal: z.number().optional(),
        }),
      ),
    });
    expect(nutritionKeysInZod(leaking)).toEqual(['kcal']);
  });

  it('treats label OCR as a different path that does copy panel numbers', () => {
    expect(nutritionKeysInZod(nutritionLabelOcrSchema)).toEqual(
      expect.arrayContaining(['kcal', 'protein_g', 'carbs_g', 'fat_g']),
    );
    expect(LLM_FOOD_LOGGING_SCHEMAS).toHaveLength(2);
    expect(LLM_FOOD_LOGGING_SCHEMAS[0]).toBe(foodExtractSchema);
  });
});
