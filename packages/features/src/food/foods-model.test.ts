import { describe, expect, it } from 'vitest';
import {
  catalogShape,
  filterCatalog,
  foodsCountLabel,
  indexMatchingQuery,
  kcalCell,
  photoKcalRange,
  uniqueAliases,
} from './foods-model';

function food(partial: {
  id?: string;
  name: string;
  source: string;
  kcal?: string;
  attribution?: string | null;
  name_tl?: string[];
}) {
  return {
    id: partial.id ?? partial.name,
    name: partial.name,
    source: partial.source,
    kcal: partial.kcal ?? '100',
    attribution: partial.attribution ?? null,
    name_tl: partial.name_tl ?? [],
  };
}

describe('Foods catalog cells', () => {
  it('never prints a point kcal for a photo row', () => {
    expect(kcalCell(food({ name: 'Carinderia plate', source: 'llm', kcal: '152' }))).toBe('—');
    expect(
      kcalCell(
        food({
          name: 'Carinderia plate',
          source: 'llm',
          kcal: '152',
          attribution: JSON.stringify({ kcal_low: 580, kcal_high: 700 }),
        }),
      ),
    ).toBe('580–700');
    expect(photoKcalRange('not-json')).toBeNull();
  });

  it('filters by source and Taglish alias', () => {
    const rows = [
      food({ id: 'k', name: 'Kanin (white rice, cooked)', source: 'ph_core', name_tl: ['sinaing'] }),
      food({ id: 'u', name: 'Skippy', source: 'user' }),
    ];
    const aliases = new Map([['k', ['bigas na luto']]]);
    expect(filterCatalog(rows, 'sinaing', 'all').map((row) => row.id)).toEqual(['k']);
    expect(filterCatalog(rows, 'bigas', 'all', aliases).map((row) => row.id)).toEqual(['k']);
    expect(filterCatalog(rows, '', 'user').map((row) => row.id)).toEqual(['u']);
  });

  it('builds the stacked-bar shape and a count label', () => {
    const shape = catalogShape([
      food({ name: 'Kanin', source: 'ph_core' }),
      food({ name: 'Kanin', source: 'ph_core' }),
      food({ name: 'Skippy', source: 'user' }),
    ]);
    expect(shape.find((slice) => slice.source === 'ph_core')?.count).toBe(2);
    expect(shape.find((slice) => slice.source === 'llm')?.count).toBe(0);
    expect(foodsCountLabel(1, 3)).toBe('1 of 3');
    expect(foodsCountLabel(3, 3)).toBe('3 foods');
  });

  it('jumps to the first name or alias match', () => {
    const rows = [
      food({ name: 'Ampalaya con carne', source: 'ph_core' }),
      food({ name: 'Kanin (white rice, cooked)', source: 'ph_core', name_tl: ['rice'] }),
    ];
    expect(indexMatchingQuery(rows, 'kanin')).toBe(1);
    expect(indexMatchingQuery(rows, 'rice')).toBe(1);
    expect(indexMatchingQuery(rows, '')).toBe(-1);
  });

  it('dedupes aliases case-insensitively', () => {
    expect(uniqueAliases(['kanin', 'Rice'], ['KANIN', 'sinaing'])).toEqual(['kanin', 'Rice', 'sinaing']);
  });
});
