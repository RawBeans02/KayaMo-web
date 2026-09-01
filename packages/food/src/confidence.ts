import type { ResolveSource } from './score';

export const CONFIDENCE_LEVELS = ['VERIFIED', 'KNOWN', 'ESTIMATED', 'LOW_CONFIDENCE'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export type ConfidenceInput = {
  source: string;
  resolvedVia?: string | null;
  confidence: number;
  verified?: boolean;
  barcode?: boolean;
  restaurantHint?: boolean;
  imageDerived?: boolean;
};

const ESTIMATED_SPREAD = 0.12;
const LOW_SPREAD = 0.2;

export function confidenceLevelFromSource(input: ConfidenceInput): ConfidenceLevel {
  const confidence = clamp01(input.confidence);
  if (input.imageDerived || input.restaurantHint || input.source === 'llm' || confidence < 0.5) {
    return 'LOW_CONFIDENCE';
  }
  if (input.verified || input.barcode || (input.source === 'user' && confidence >= 0.9)) {
    return 'VERIFIED';
  }
  if (
    (input.source === 'ph_core' || input.source === 'off' || input.source === 'usda_fdc') &&
    confidence >= 0.75
  ) {
    return 'KNOWN';
  }
  if (confidence >= 0.75) return 'KNOWN';
  return 'ESTIMATED';
}

export function calorieRange(
  kcal: number,
  level: ConfidenceLevel,
): { calories: number; caloriesLow: number; caloriesHigh: number } {
  const calories = Math.max(0, Math.round(kcal));
  if (level === 'VERIFIED' || level === 'KNOWN') {
    return { calories, caloriesLow: calories, caloriesHigh: calories };
  }
  const spread = level === 'LOW_CONFIDENCE' ? LOW_SPREAD : ESTIMATED_SPREAD;
  return {
    calories,
    caloriesLow: Math.max(0, Math.round(calories * (1 - spread))),
    caloriesHigh: Math.round(calories * (1 + spread)),
  };
}

export function sourceTypeFromResolve(
  source: ResolveSource | string,
  opts: { barcode?: boolean; verified?: boolean } = {},
): string {
  if (opts.verified || source === 'user') return 'user_confirmed';
  if (opts.barcode) return 'barcode';
  if (source === 'off') return 'branded_database';
  if (source === 'ph_core' || source === 'usda_fdc') return 'generic_database';
  if (source === 'llm') return 'ai_estimate';
  return 'homemade_estimate';
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
