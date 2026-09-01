/**
 * Machine-local PH-core verify overlay.
 *
 * Authenticated clients cannot UPDATE `foods` where `source != 'user'`.
 * Until `verify_ph_core_food` exists as SECURITY DEFINER, a verify on this
 * screen is Dexie + localStorage on this browser only. Clearing site data
 * drops it. Another device, including Android, never sees it.
 *
 * When the RPC lands, `migrateVerifyOverlay` pushes verified rows once and
 * drops them from this key so the sitting is not done twice.
 */
const STORAGE_KEY = 'kayamo:ph-core-verify';

import type { VerifyOverlayEntry } from './verify-model';

export function readVerifyOverlay(): Record<string, VerifyOverlayEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, VerifyOverlayEntry>;
  } catch {
    return {};
  }
}

export function writeVerifyOverlay(overlay: Record<string, VerifyOverlayEntry>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
}

export function upsertVerifyOverlay(
  foodId: string,
  entry: VerifyOverlayEntry,
): Record<string, VerifyOverlayEntry> {
  const next = { ...readVerifyOverlay(), [foodId]: entry };
  writeVerifyOverlay(next);
  return next;
}

export function replaceVerifyOverlay(overlay: Record<string, VerifyOverlayEntry>): void {
  writeVerifyOverlay(overlay);
}
