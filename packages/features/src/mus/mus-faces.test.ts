import { describe, expect, it } from 'vitest';
import { musFaceFor, musFaceForReply, musFaceSrc } from './mus-faces';

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

  it('ships all four faces from public/botanical as WebP', () => {
    expect(musFaceSrc('neutral')).toBe('/botanical/mus-neutral.webp');
    expect(musFaceSrc('thinking')).toBe('/botanical/mus-thinking.webp');
    expect(musFaceSrc('happy')).toBe('/botanical/mus-happy.webp');
    expect(musFaceSrc('concerned')).toBe('/botanical/mus-concerned.webp');
  });
});
/**
 * The expression system existed with no input, and `tone` existed with no
 * reader. This is the seam between them.
 */
describe('musFaceForReply', () => {
  it('shows concern for a gentle reply', () => {
    expect(musFaceForReply({ tone: 'gentle', safetyLevel: 'safe' })).toBe('concerned');
  });

  it('stays neutral for balanced and firm', () => {
    expect(musFaceForReply({ tone: 'balanced', safetyLevel: 'safe' })).toBe('neutral');
    expect(musFaceForReply({ tone: 'firm', safetyLevel: 'safe' })).toBe('neutral');
  });

  it('lets safety outrank whatever tone the model declared', () => {
    // A crisis reply is concern for the person, never a neutral acknowledgement.
    expect(musFaceForReply({ tone: 'firm', safetyLevel: 'urgent' })).toBe('concerned');
    expect(musFaceForReply({ tone: 'balanced', safetyLevel: 'supportive_redirect' })).toBe(
      'concerned',
    );
  });

  it('falls back to neutral when nothing is known', () => {
    expect(musFaceForReply({})).toBe('neutral');
    expect(musFaceForReply({ tone: null, safetyLevel: null })).toBe('neutral');
  });
});
