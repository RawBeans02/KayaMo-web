import { describe, expect, it, vi } from 'vitest';
import { migrateVerifyOverlay, pushVerifiedOverlayEntry, type VerifyRpcClient } from './verify-rpc';
import type { VerifyOverlayEntry } from './verify-model';

function entry(partial: Partial<VerifyOverlayEntry> = {}): VerifyOverlayEntry {
  return {
    kcal: '130',
    protein_g: '2.7',
    carbs_g: '28.2',
    fat_g: '0.3',
    source_note: 'USDA cooked white rice',
    verified: true,
    skipped: false,
    baseConfidence: '0.80',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...partial,
  };
}

function clientWith(error: { message: string; code?: string } | null): VerifyRpcClient {
  return {
    rpc: vi.fn(async () => ({ error })),
  };
}

describe('verify RPC overlay migration', () => {
  it('treats a missing function as “keep the local overlay”', async () => {
    const client = clientWith({ message: 'Could not find the function', code: 'PGRST202' });
    const overlay = { kanin: entry() };
    const result = await migrateVerifyOverlay(client, overlay);
    expect(result.missing).toBe(true);
    expect(result.pushed).toBe(0);
    expect(result.overlay).toEqual(overlay);
    expect(await pushVerifiedOverlayEntry(client, 'kanin', entry())).toBe('missing');
  });

  it('drops a row from the overlay once the RPC accepts it', async () => {
    const client = clientWith(null);
    const overlay = { kanin: entry(), adobo: entry({ verified: false }) };
    const result = await migrateVerifyOverlay(client, overlay);
    expect(result.missing).toBe(false);
    expect(result.pushed).toBe(1);
    expect(result.overlay.kanin).toBeUndefined();
    expect(result.overlay.adobo?.verified).toBe(false);
  });
});
