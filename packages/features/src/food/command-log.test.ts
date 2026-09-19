import { describe, expect, it } from 'vitest';
import type { FoodCandidate } from '@kayamo/food/search-ui';
import {
  clampSelectedIndex,
  catalogForCommandLog,
  candidateFromCatalogFood,
  cycleMealSlot,
  frequencyLabel,
  idlePaletteStatus,
  leaveHrefFromPaletteKey,
  loggedStatus,
  mealSlotFromDigit,
  paletteStateLabel,
  paletteView,
  plateTotalKcal,
  previewQtyKcal,
  quantityFromCandidate,
  readyCatalogFoods,
  servingCaption,
  servingIdForLabel,
  toLogInputFromCandidate,
} from './command-log-model';

function candidate(partial: Partial<FoodCandidate> = {}): FoodCandidate {
  return {
    foodId: '11111111-1111-1111-1111-111111111111',
    name: 'Kanin',
    source: 'ph_core',
    confidence: 0.52,
    rankScore: 0.9,
    matchScore: 1,
    timesLogged: 2,
    whyMatched: 'name',
    per100g: {
      kcal: 130,
      protein_g: 2.7,
      carbs_g: 28,
      fat_g: 0.3,
      fiber_g: 0.4,
      sugar_g: 0.1,
      sodium_mg: 1,
    },
    servings: [{ label: 'tasa', grams: 150, isDefault: true }],
    portion: {
      amount: 1,
      unit: 'tasa',
      grams: 150,
      servingLabel: 'tasa',
      kcal: 195,
    },
    ...partial,
  };
}

describe('command log helpers', () => {
  it('maps digit keys onto meal slots and cycles with brackets', () => {
    expect(mealSlotFromDigit('1')).toBe('almusal');
    expect(mealSlotFromDigit('4')).toBe('hapunan');
    expect(cycleMealSlot('almusal', 1)).toBe('tanghalian');
    expect(cycleMealSlot('almusal', -1)).toBe('hapunan');
  });

  it('scales the default serving when Tab overrides quantity', () => {
    const qty = quantityFromCandidate(candidate(), 2);
    expect(qty.quantity).toBe('2');
    expect(qty.grams).toBe('300');
    expect(qty.servingLabel).toBe('2 × tasa');
  });

  it('builds the same search log payload the PWA search path uses', () => {
    const input = toLogInputFromCandidate({
      userId: 'user-1',
      mealSlot: 'tanghalian',
      candidate: candidate(),
      servingId: 'serving-1',
      timeZone: 'Asia/Manila',
      dayStartsAt: '00:00:00',
    });
    expect(input).toMatchObject({
      userId: 'user-1',
      mealSlot: 'tanghalian',
      foodId: '11111111-1111-1111-1111-111111111111',
      foodName: 'Kanin',
      quantity: '1',
      grams: '150',
      inputMethod: 'search',
      source: 'ph_core',
      resolvedVia: 'ph_core',
      servingId: 'serving-1',
      servingLabel: 'tasa',
      timeZone: 'Asia/Manila',
      dayStartsAt: '00:00:00',
    });
    expect(Number(input?.kcal)).toBeCloseTo(195, 5);
  });

  it('refuses to log a candidate without a persistable food id', () => {
    expect(
      toLogInputFromCandidate({
        userId: 'user-1',
        mealSlot: 'almusal',
        candidate: candidate({ foodId: 'llm-estimate' }),
        servingId: null,
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
      }),
    ).toBeNull();
  });

  it('picks the default serving id when the portion label is missing', () => {
    expect(
      servingIdForLabel(
        [
          { id: 'a', label: 'piraso', is_default: false },
          { id: 'b', label: 'tasa', is_default: true },
        ],
        null,
      ),
    ).toBe('b');
  });

  it('clamps the highlighted row', () => {
    expect(clampSelectedIndex(9, 3)).toBe(2);
    expect(clampSelectedIndex(-1, 3)).toBe(0);
    expect(clampSelectedIndex(0, 0)).toBe(0);
  });

  it('includes sourced foods across cuisines and providers', () => {
    const per100g = {
      kcal: 100,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    };
    const servings = [{ label: '100 g', grams: 100, isDefault: true }];
    const kept = catalogForCommandLog([
      {
        id: 'ph',
        name: 'Kanin',
        source: 'ph_core',
        sourceId: null,
        nameTl: [],
        aliases: [],
        brand: null,
        barcode: null,
        per100g,
        confidence: 0.5,
        servings,
        createdBy: null,
      },
      {
        id: 'mine',
        name: 'Lutong bahay',
        source: 'user',
        sourceId: null,
        nameTl: [],
        aliases: [],
        brand: null,
        barcode: null,
        per100g,
        confidence: 1,
        servings,
        createdBy: 'user-1',
      },
      {
        id: 'usda',
        name: 'Rice, white, cooked',
        source: 'usda_fdc',
        sourceId: '123',
        nameTl: [],
        aliases: [],
        brand: null,
        barcode: null,
        per100g,
        confidence: 0.8,
        servings,
        createdBy: null,
      },
      {
        id: 'off',
        name: 'Lucky Me',
        source: 'off',
        sourceId: '456',
        nameTl: [],
        aliases: [],
        brand: 'Lucky Me',
        barcode: null,
        per100g,
        confidence: 0.7,
        servings,
        createdBy: null,
      },
    ]);
    expect(kept.map((row) => row.id)).toEqual(['ph', 'mine', 'usda', 'off']);
  });

  it('keeps four palette states exclusive and labels them', () => {
    expect(paletteView('', false, 0)).toBe('ready');
    expect(paletteView('kanin', true, 0)).toBe('searching');
    expect(paletteView('kanin', false, 3)).toBe('results');
    expect(paletteView('kanin', false, 0)).toBe('none');
    expect(paletteStateLabel('ready', 0)).toBe('ready');
    expect(paletteStateLabel('results', 1)).toBe('1 match');
    expect(paletteStateLabel('results', 3)).toBe('3 matches');
    expect(paletteStateLabel('none', 0)).toBe('no match');
  });

  it('ranks ready suggestions by log count, then name', () => {
    const per100g = {
      kcal: 100,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    };
    const servings = [{ label: 'tasa', grams: 150, isDefault: true }];
    const ranked = readyCatalogFoods(
      [
        {
          id: 'b',
          name: 'Banana cue',
          source: 'ph_core',
          sourceId: null,
          nameTl: [],
          aliases: [],
          brand: null,
          barcode: null,
          per100g,
          confidence: 0.5,
          servings,
          createdBy: null,
        },
        {
          id: 'a',
          name: 'Adobo',
          source: 'ph_core',
          sourceId: null,
          nameTl: ['adobo'],
          aliases: [],
          brand: null,
          barcode: null,
          per100g,
          confidence: 0.5,
          servings,
          createdBy: null,
        },
        {
          id: 'k',
          name: 'Kanin',
          source: 'ph_core',
          sourceId: null,
          nameTl: [],
          aliases: [],
          brand: null,
          barcode: null,
          per100g,
          confidence: 0.5,
          servings,
          createdBy: null,
        },
      ],
      new Map([
        ['k', 12],
        ['a', 12],
      ]),
      2,
    );
    expect(ranked.map((row) => row.id)).toEqual(['a', 'k']);
  });

  it('builds a persistable candidate from a catalog row and plate totals', () => {
    const food = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Kanin',
      source: 'ph_core' as const,
      sourceId: null,
      nameTl: [],
      aliases: [],
      brand: null,
      barcode: null,
      per100g: {
        kcal: 130,
        protein_g: 2.7,
        carbs_g: 28,
        fat_g: 0.3,
        fiber_g: 0.4,
        sugar_g: 0.1,
        sodium_mg: 1,
      },
      confidence: 0.52,
      servings: [{ label: 'tasa', grams: 150, isDefault: true }],
      createdBy: null,
    };
    const hit = candidateFromCatalogFood(food, 4);
    expect(hit.portion.grams).toBe(150);
    expect(hit.portion.kcal).toBeCloseTo(195);
    expect(frequencyLabel(hit.timesLogged)).toBe('4×');
    expect(servingCaption(hit.portion)).toBe('tasa · 150 g');
    expect(previewQtyKcal(195, 1, '2')).toBe(390);
    expect(plateTotalKcal([{ id: '1', label: 'Kanin', kcal: 195 }, { id: '2', label: 'Adobo', kcal: 226 }])).toBe(421);
    expect(loggedStatus('Tanghalian')).toBe('Logged · Tanghalian · palette stays open');
    expect(idlePaletteStatus(0)).toContain('Stays open');
    expect(idlePaletteStatus(2)).toBe('2 logged · keep going');
  });

  it('maps no-match shortcuts onto leave routes, not writes', () => {
    expect(leaveHrefFromPaletteKey({ metaKey: true, ctrlKey: false, shiftKey: false, key: 'n' })).toBe('/foods');
    expect(leaveHrefFromPaletteKey({ metaKey: true, ctrlKey: false, shiftKey: true, key: 'f' })).toBe('/foods');
    expect(leaveHrefFromPaletteKey({ metaKey: false, ctrlKey: true, shiftKey: false, key: 'm' })).toBe('/mus');
    expect(leaveHrefFromPaletteKey({ metaKey: true, ctrlKey: false, shiftKey: false, key: 'k' })).toBeNull();
  });
});

describe('locally edited catalog rows', () => {
  // A row whose numbers came from this browser's Verify overlay still belongs
  // to its catalog source, but the numbers were resolved by the person, not by
  // the source. resolved_via says so; source keeps the food's identity.
  it('logs an overlaid candidate as resolved by the user', () => {
    const input = toLogInputFromCandidate({
      userId: 'u',
      mealSlot: 'tanghalian',
      candidate: candidate({ locallyEdited: true, confidence: 0.52 }),
      servingId: null,
      timeZone: 'Asia/Manila',
      dayStartsAt: '05:00:00',
    });
    expect(input?.source).toBe('ph_core');
    expect(input?.resolvedVia).toBe('user');
    expect(input?.confidence).toBe('0.52');
  });

  it('leaves an untouched catalog row resolved by its source', () => {
    const input = toLogInputFromCandidate({
      userId: 'u',
      mealSlot: 'tanghalian',
      candidate: candidate(),
      servingId: null,
      timeZone: 'Asia/Manila',
      dayStartsAt: '05:00:00',
    });
    expect(input?.resolvedVia).toBe('ph_core');
  });
});

