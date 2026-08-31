/** Atwater 4/4/9 vs stated kcal, same 5% gate as @kayamo/food PH core validation. */
export const ATWATER_TOLERANCE = 0.05;

export function atwaterExpectedKcal(protein: number, carbs: number, fat: number): number {
  return 4 * protein + 4 * carbs + 9 * fat;
}

export function atwaterDeltaFromMacros(params: {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}): number {
  const expected = atwaterExpectedKcal(params.protein, params.carbs, params.fat);
  const denom = Math.max(params.kcal, expected, 1);
  return Math.abs(params.kcal - expected) / denom;
}

export function macrosOffByMoreThanFivePercent(params: {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}): boolean {
  return atwaterDeltaFromMacros(params) > ATWATER_TOLERANCE;
}
