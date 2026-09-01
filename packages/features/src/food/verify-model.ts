import {
  ATWATER_TOLERANCE,
  atwaterDeltaFromMacros,
  atwaterExpectedKcal,
} from './atwater-check';

export const BATCH_MIN_CONFIDENCE = 0.9;
/** Treat as 0% drift — tighter than the 5% table flag. */
export const ZERO_DRIFT_MAX = 0.0005;

export type VerifyDraft = {
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  source_note: string;
};

export type VerifyOverlayEntry = VerifyDraft & {
  verified: boolean;
  skipped: boolean;
  baseConfidence: string;
  updatedAt: string;
};

export type VerifyFoodLike = {
  id: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  source_note: string | null;
  confidence: string;
  verified_by_user: boolean;
};

export function draftFromFood(food: VerifyFoodLike): VerifyDraft {
  return {
    kcal: food.kcal,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
    source_note: food.source_note ?? '',
  };
}

export function draftsEqual(a: VerifyDraft, b: VerifyDraft): boolean {
  return (
    a.kcal === b.kcal &&
    a.protein_g === b.protein_g &&
    a.carbs_g === b.carbs_g &&
    a.fat_g === b.fat_g &&
    a.source_note === b.source_note
  );
}

export function parseDraftNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function atwaterFromDraft(draft: VerifyDraft): {
  expected: number;
  stated: number;
  percent: number;
  reconciles: boolean;
  title: string;
  detail: string;
} {
  const kcal = parseDraftNumber(draft.kcal);
  const protein = parseDraftNumber(draft.protein_g);
  const carbs = parseDraftNumber(draft.carbs_g);
  const fat = parseDraftNumber(draft.fat_g);
  const expected = atwaterExpectedKcal(protein, carbs, fat);
  const delta = atwaterDeltaFromMacros({ kcal, protein, carbs, fat });
  const off = delta > ATWATER_TOLERANCE;
  return {
    expected,
    stated: kcal,
    percent: delta * 100,
    reconciles: !off,
    title: off ? 'Macros do not reconcile' : 'Macros reconcile',
    detail: `4P + 4C + 9F = ${formatMacro(expected)} · stated ${formatMacro(kcal)} · ${(delta * 100).toFixed(1)}% apart`,
  };
}

function formatMacro(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function isZeroDrift(draft: VerifyDraft): boolean {
  return (
    atwaterDeltaFromMacros({
      kcal: parseDraftNumber(draft.kcal),
      protein: parseDraftNumber(draft.protein_g),
      carbs: parseDraftNumber(draft.carbs_g),
      fat: parseDraftNumber(draft.fat_g),
    }) <= ZERO_DRIFT_MAX
  );
}

export function isBatchReady(food: VerifyFoodLike, draft: VerifyDraft): boolean {
  return !food.verified_by_user && Number(food.confidence) >= BATCH_MIN_CONFIDENCE && isZeroDrift(draft);
}

export function applyOverlayToFood<T extends VerifyFoodLike>(
  food: T,
  entry: VerifyOverlayEntry | undefined,
): T {
  if (!entry) return food;
  return {
    ...food,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    source_note: entry.source_note,
    verified_by_user: entry.verified,
    confidence: entry.verified ? '1.00' : entry.baseConfidence,
  };
}

export function overlayFromFood(
  food: VerifyFoodLike,
  draft: VerifyDraft,
  flags: { verified: boolean; skipped: boolean },
  previous?: VerifyOverlayEntry,
  now = new Date().toISOString(),
): VerifyOverlayEntry {
  return {
    ...draft,
    verified: flags.verified,
    skipped: flags.skipped,
    baseConfidence: previous?.baseConfidence ?? food.confidence,
    updatedAt: now,
  };
}

export function verifyLede(verified: number, total: number): string {
  if (total === 0) return 'PH core is still loading.';
  if (verified === 0) {
    return total === 40
      ? 'Forty hand-built dishes, each with estimated nutrition that needs a human pass. Every number here is provisional until you say otherwise.'
      : `${total} hand-built dishes, each with estimated nutrition that needs a human pass. Every number here is provisional until you say otherwise.`;
  }
  if (verified === total) {
    return `All ${total} dishes are now trusted data.`;
  }
  if (verified >= 31) {
    return 'Thirty-one dishes are now trusted data. The nine left are the ones with the widest recipe variation — worth slowing down for.';
  }
  return `${verified} down. The queue sorts by how often you have logged the dish, so the ones that matter most come first.`;
}

export function meanConfidence(rows: readonly VerifyFoodLike[]): string {
  if (rows.length === 0) return '—';
  const sum = rows.reduce((acc, row) => acc + (row.verified_by_user ? 1 : Number(row.confidence) || 0), 0);
  return (sum / rows.length).toFixed(2);
}

export function driftCount(rows: readonly VerifyFoodLike[]): number {
  return rows.filter((row) =>
    atwaterDeltaFromMacros({
      kcal: Number(row.kcal) || 0,
      protein: Number(row.protein_g) || 0,
      carbs: Number(row.carbs_g) || 0,
      fat: Number(row.fat_g) || 0,
    }) > ATWATER_TOLERANCE,
  ).length;
}

export function nextUnverifiedIndex(
  rows: readonly { verified: boolean; skipped: boolean }[],
  from: number,
  direction: 1 | -1,
): number {
  if (rows.length === 0) return 0;
  for (let step = 1; step <= rows.length; step += 1) {
    const index = (from + direction * step + rows.length * step) % rows.length;
    const row = rows[index];
    if (row && !row.verified && !row.skipped) return index;
  }
  return from;
}

export function pcfLabel(protein: number, carbs: number, fat: number): string {
  const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${one(protein)} / ${one(carbs)} / ${one(fat)}`;
}
