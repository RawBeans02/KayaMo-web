import { calorieRange, confidenceLevelFromSource, type ConfidenceLevel } from './confidence';
import { fromNumericString } from './numeric';

export type DailyNutritionEntry = {
  kcal: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
  fiber_g?: string | number | null;
  sodium_mg?: string | number | null;
  source: string;
  resolved_via?: string | null;
  confidence: string | number;
  deleted_at?: string | null;
  verified?: boolean;
  restaurantHint?: boolean;
  imageDerived?: boolean;
};

export type DailyNutrition = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  verified_calories: number;
  estimated_calories: number;
  estimated_low: number;
  estimated_high: number;
  byLevel: Record<ConfidenceLevel, number>;
};

function active(entries: readonly DailyNutritionEntry[]): DailyNutritionEntry[] {
  return entries.filter((row) => !row.deleted_at);
}

/** Deterministic day totals. The model never produces this object. */
export function calculateDailyNutrition(entries: readonly DailyNutritionEntry[]): DailyNutrition {
  const byLevel: Record<ConfidenceLevel, number> = {
    VERIFIED: 0,
    KNOWN: 0,
    ESTIMATED: 0,
    LOW_CONFIDENCE: 0,
  };
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sodium = 0;
  let verified = 0;
  let estimated = 0;
  let low = 0;
  let high = 0;

  for (const row of active(entries)) {
    const kcal = fromNumericString(row.kcal);
    const level = confidenceLevelFromSource({
      source: row.source,
      resolvedVia: row.resolved_via,
      confidence: fromNumericString(row.confidence),
      verified: row.verified,
      restaurantHint: row.restaurantHint,
      imageDerived: row.imageDerived,
    });
    const range = calorieRange(kcal, level);
    calories += range.calories;
    protein += fromNumericString(row.protein_g);
    carbs += fromNumericString(row.carbs_g);
    fat += fromNumericString(row.fat_g);
    fiber += fromNumericString(row.fiber_g);
    sodium += fromNumericString(row.sodium_mg);
    byLevel[level] += range.calories;
    if (level === 'VERIFIED' || level === 'KNOWN') {
      verified += range.calories;
      low += range.calories;
      high += range.calories;
    } else {
      estimated += range.calories;
      low += range.caloriesLow;
      high += range.caloriesHigh;
    }
  }

  return {
    calories: Math.round(calories),
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat),
    fiber_g: Math.round(fiber),
    sodium_mg: Math.round(sodium),
    verified_calories: Math.round(verified),
    estimated_calories: Math.round(estimated),
    estimated_low: Math.round(low),
    estimated_high: Math.round(high),
    byLevel,
  };
}
