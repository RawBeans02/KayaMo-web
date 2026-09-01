import { isMissingRpcError } from '@kayamo/db';
import { replaceVerifyOverlay } from './verify-overlay';
import type { VerifyOverlayEntry } from './verify-model';

export type VerifyRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string; code?: string } | null }>;
};

export type VerifyRpcResult = 'pushed' | 'missing' | 'rejected';

function nutrientsFromEntry(entry: VerifyOverlayEntry): Record<string, string> {
  return {
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    source_note: entry.source_note,
  };
}

export async function pushVerifiedOverlayEntry(
  client: VerifyRpcClient,
  foodId: string,
  entry: VerifyOverlayEntry,
): Promise<VerifyRpcResult> {
  if (!entry.verified) return 'rejected';
  const { error } = await client.rpc('verify_ph_core_food', {
    food_id: foodId,
    nutrients: nutrientsFromEntry(entry),
    serving: null,
  });
  if (!error) return 'pushed';
  if (isMissingRpcError(error)) return 'missing';
  return 'rejected';
}

export async function migrateVerifyOverlay(
  client: VerifyRpcClient,
  overlay: Record<string, VerifyOverlayEntry>,
): Promise<{ overlay: Record<string, VerifyOverlayEntry>; pushed: number; missing: boolean }> {
  const verified = Object.entries(overlay).filter(([, entry]) => entry.verified);
  if (verified.length === 0) return { overlay, pushed: 0, missing: false };

  const next = { ...overlay };
  let pushed = 0;
  for (const [foodId, entry] of verified) {
    const result = await pushVerifiedOverlayEntry(client, foodId, entry);
    if (result === 'missing') return { overlay, pushed: 0, missing: true };
    if (result === 'pushed') {
      delete next[foodId];
      pushed += 1;
    }
  }
  if (pushed > 0) replaceVerifyOverlay(next);
  return { overlay: next, pushed, missing: false };
}
