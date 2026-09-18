import { describe, expect, it } from 'vitest';
import { macrosOffByMoreThanFivePercent } from './atwater-check';
import {
  applyOverlayToFood,
  atwaterFromDraft,
  draftFromFood,
  draftsEqual,
  isBatchReady,
  isZeroDrift,
  meanConfidence,
  nextUnverifiedIndex,
  overlayFromFood,
  verifyLede,
  type VerifyDraft,
  type VerifyFoodLike,
} from './verify-model';

function food(partial: Partial<VerifyFoodLike> = {}): VerifyFoodLike {
  return {
    id: 'adobo',
    kcal: '160',
    protein_g: '16',
    carbs_g: '4',
    fat_g: '8',
    source_note: 'USDA chicken + soy',
    confidence: '0.52',
    verified_by_user: false,
    ...partial,
  };
}

describe('live Atwater from inspector draft', () => {
  it('recomputes 4/4/9 as the typed numbers change, not from a seed snapshot', () => {
    const start = atwaterFromDraft(draftFromFood(food()));
    expect(start.reconciles).toBe(true);
    expect(start.detail).toContain('4P + 4C + 9F = 152');
    const drifted = atwaterFromDraft({
      kcal: '500',
      protein_g: '10',
      carbs_g: '10',
      fat_g: '10',
      source_note: '',
    });
    expect(drifted.reconciles).toBe(false);
    expect(drifted.title).toBe('Macros do not reconcile');
    expect(drifted.detail).toMatch(/stated 500/);
    expect(drifted.percent).toBeGreaterThan(5);
  });

  it('marks a draft dirty when a macro changes', () => {
    const row = food();
    const draft = draftFromFood(row);
    expect(draftsEqual(draft, draftFromFood(row))).toBe(true);
    expect(draftsEqual({ ...draft, protein_g: '18' }, draftFromFood(row))).toBe(false);
  });
});

describe('verify queue', () => {
  it('jumps past verified and skipped rows so a stuck dish does not block the sitting', () => {
    const rows = [
      { verified: true, skipped: false },
      { verified: false, skipped: true },
      { verified: false, skipped: false },
      { verified: false, skipped: false },
    ];
    expect(nextUnverifiedIndex(rows, 0, 1)).toBe(2);
    expect(nextUnverifiedIndex(rows, 2, 1)).toBe(3);
    expect(nextUnverifiedIndex(rows, 3, 1)).toBe(2);
    expect(nextUnverifiedIndex(rows, 3, -1)).toBe(2);
  });

  it('rewrites the lede at 0, mid, and 31', () => {
    expect(verifyLede(0, 40)).toMatch(/Forty hand-built dishes/);
    expect(verifyLede(12, 40)).toMatch(/^12 down/);
    expect(verifyLede(31, 40)).toMatch(/Thirty-one dishes are now trusted data/);
    expect(verifyLede(40, 40)).toMatch(/All 40 dishes/);
  });

  it('counts verified rows as 1.00 in the mean', () => {
    expect(
      meanConfidence([
        food({ confidence: '0.52', verified_by_user: false }),
        food({ id: 'kanin', confidence: '0.52', verified_by_user: true }),
      ]),
    ).toBe('0.76');
  });
});

describe('overlay and batch gate', () => {
  it('applies a verified overlay onto a PH-core row without inventing nutrition', () => {
    const next = applyOverlayToFood(food(), {
      kcal: '165',
      protein_g: '16',
      carbs_g: '4',
      fat_g: '9',
      source_note: 'USDA chicken + soy, fat rounded',
      verified: true,
      skipped: false,
      baseConfidence: '0.52',
      updatedAt: '2026-09-02T00:00:00.000Z',
    });
    expect(next.verified_by_user).toBe(true);
    // This used to expect '1.00'. A verification made in one browser is the
    // person's own check, not new certainty about the source, and stamping
    // 1.00 under source=ph_core made logged entries claim server provenance
    // for numbers only this device had. The base confidence is what the row
    // honestly carries. Product decision, 2026-09-18; see the commit.
    expect(next.confidence).toBe('0.52');
    expect(next.kcal).toBe('165');
    expect(next.source_note).toBe('USDA chicken + soy, fat rounded');
  });

  it('keeps the catalog confidence when un-verifying an already-overlaid row', () => {
    const row = food({ confidence: '1.00', verified_by_user: true });
    const previous = {
      ...draftFromFood(row),
      verified: true,
      skipped: false,
      baseConfidence: '0.52',
      updatedAt: '2026-09-02T00:00:00.000Z',
    };
    const entry = overlayFromFood(row, draftFromFood(row), { verified: false, skipped: false }, previous);
    expect(entry.baseConfidence).toBe('0.52');
    expect(applyOverlayToFood(row, entry).confidence).toBe('0.52');
    expect(applyOverlayToFood(row, entry).verified_by_user).toBe(false);
  });

  it('only batch-verifies zero-drift rows at or above 0.9 confidence', () => {
    const reconciling: VerifyDraft = {
      kcal: '170',
      protein_g: '10',
      carbs_g: '10',
      fat_g: '10',
      source_note: '',
    };
    expect(isZeroDrift(reconciling)).toBe(true);
    expect(isBatchReady(food({ confidence: '0.92', kcal: '170', protein_g: '10', carbs_g: '10', fat_g: '10' }), reconciling)).toBe(true);
    expect(isBatchReady(food({ confidence: '0.52', kcal: '170', protein_g: '10', carbs_g: '10', fat_g: '10' }), reconciling)).toBe(false);
    expect(
      isBatchReady(
        food({ confidence: '0.95' }),
        { kcal: '500', protein_g: '10', carbs_g: '10', fat_g: '10', source_note: '' },
      ),
    ).toBe(false);
    expect(
      macrosOffByMoreThanFivePercent({ kcal: 500, protein: 10, carbs: 10, fat: 10 }),
    ).toBe(true);
  });
});

describe('overlay provenance', () => {
  // The overlay lives in this browser. Marking a row verified used to also set
  // its confidence to 1.00 while leaving source = ph_core, so entries logged
  // afterwards claimed server-grade certainty for numbers only this device had.
  it('keeps the base confidence when the user verifies locally', () => {
    const row = food({ confidence: '0.52' });
    const draft = { ...draftFromFood(row), kcal: '170' };
    const entry = overlayFromFood(row, draft, { verified: true, skipped: false });
    const patched = applyOverlayToFood(row, entry);
    expect(patched.kcal).toBe('170');
    expect(patched.verified_by_user).toBe(true);
    expect(patched.confidence).toBe('0.52');
  });

  it('never reports 1.00 from an overlay, verified or not', () => {
    const row = food({ confidence: '0.80' });
    const unverified = applyOverlayToFood(row, overlayFromFood(row, draftFromFood(row), { verified: false, skipped: false }));
    const verified = applyOverlayToFood(row, overlayFromFood(row, draftFromFood(row), { verified: true, skipped: false }));
    expect(unverified.confidence).toBe('0.80');
    expect(verified.confidence).toBe('0.80');
  });
});

