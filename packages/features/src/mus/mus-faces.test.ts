import { describe, expect, it } from 'vitest';
import { musFaceFor, musFaceSrc } from './mus-faces';

describe('Mus faces', () => {
  it('uses concerned only for wellbeing, never for a missed log or over-target day', () => {
    expect(musFaceFor({ kind: 'wellbeing_concern' })).toBe('concerned');
    expect(musFaceFor({ kind: 'missed_log' })).toBe('neutral');
    expect(musFaceFor({ kind: 'over_target' })).toBe('neutral');
    expect(musFaceFor({ kind: 'gap' })).toBe('neutral');
  });

  it('reserves happy for a milestone the user chose', () => {
    expect(musFaceFor({ kind: 'chosen_milestone' })).toBe('happy');
    expect(musFaceFor({ kind: 'idle' })).toBe('neutral');
    expect(musFaceFor({ kind: 'thinking' })).toBe('thinking');
  });

  it('has no raster for happy or concerned yet — those stay labeled slots', () => {
    expect(musFaceSrc('neutral')).toBe('/mus-neutral.png');
    expect(musFaceSrc('thinking')).toBe('/mus-thinking.png');
    expect(musFaceSrc('happy')).toBeNull();
    expect(musFaceSrc('concerned')).toBeNull();
  });
});
