import { describe, expect, it, vi } from 'vitest';
import {
  JUDGE_DIMENSIONS,
  judgePair,
  slotForCase,
  tallyVerdicts,
  type JudgeVerdict,
} from './judge';

/**
 * The judge's plumbing, tested for free.
 *
 * `completeObject` takes an injectable `generateObject`, so shuffling, unmapping
 * and aggregation are all exercised with a fake. The only thing that needs a
 * real model is the judgement itself.
 */

function fakeJudge(winner: 'A' | 'B' | 'tie') {
  return vi.fn(async () => ({ object: { winner, reason: 'because' } }));
}

const base = {
  userMessage: 'im so tired of all of this',
  baseline: 'You should try to stay consistent.',
  candidate: 'That sounds heavy. What is the one thing that would help most?',
  dimension: 'warmth' as const,
  userId: 'user-1',
};

describe('judgePair maps the shuffle back correctly', () => {
  it('credits the candidate when it sat in slot A and A won', async () => {
    const verdict = await judgePair(
      { ...base, candidateSlot: 'A' },
      { generateObject: fakeJudge('A') },
    );
    expect(verdict.winner).toBe('candidate');
  });

  it('credits the baseline when the candidate sat in slot A and B won', async () => {
    const verdict = await judgePair(
      { ...base, candidateSlot: 'A' },
      { generateObject: fakeJudge('B') },
    );
    expect(verdict.winner).toBe('baseline');
  });

  it('credits the candidate when it sat in slot B and B won', async () => {
    const verdict = await judgePair(
      { ...base, candidateSlot: 'B' },
      { generateObject: fakeJudge('B') },
    );
    expect(verdict.winner).toBe('candidate');
  });

  it('passes ties straight through', async () => {
    const verdict = await judgePair(
      { ...base, candidateSlot: 'B' },
      { generateObject: fakeJudge('tie') },
    );
    expect(verdict.winner).toBe('tie');
  });

  /**
   * The property that matters: a judge with a fixed positional preference must
   * produce the opposite credited winner when the slots swap. If this ever
   * passes for both slots, the unmapping is broken and every live result is
   * measuring position rather than voice.
   */
  it('a position-biased judge flips the credited winner when slots swap', async () => {
    const alwaysA = fakeJudge('A');
    const asA = await judgePair(
      { ...base, candidateSlot: 'A' },
      { generateObject: alwaysA },
    );
    const asB = await judgePair(
      { ...base, candidateSlot: 'B' },
      { generateObject: alwaysA },
    );
    expect(asA.winner).not.toBe(asB.winner);
  });

  it('puts the candidate in the slot it was assigned', async () => {
    const capture = vi.fn(async (args: { messages: { content: unknown }[] }) => {
      const content = String(args.messages[0]!.content);
      const aIndex = content.indexOf('Reply A:');
      const bIndex = content.indexOf('Reply B:');
      expect(content.slice(aIndex, bIndex)).toContain(base.candidate);
      return { object: { winner: 'tie', reason: 'x' } };
    });
    await judgePair(
      { ...base, candidateSlot: 'A' },
      { generateObject: capture as never },
    );
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('asks about exactly one dimension per call', async () => {
    for (const dimension of JUDGE_DIMENSIONS) {
      const capture = vi.fn(async (args: { messages: { content: unknown }[] }) => {
        const content = String(args.messages[0]!.content);
        const named = JUDGE_DIMENSIONS.filter((other) => content.includes(other));
        expect(named).toEqual([dimension]);
        return { object: { winner: 'tie', reason: 'x' } };
      });
      await judgePair(
        { ...base, dimension, candidateSlot: 'A' },
        { generateObject: capture as never },
      );
    }
  });
});

describe('slotForCase', () => {
  it('is stable for the same case and dimension', () => {
    expect(slotForCase('voice-01', 'warmth')).toBe(slotForCase('voice-01', 'warmth'));
  });

  it('does not put every case in the same slot', () => {
    const slots = new Set(
      ['voice-01', 'voice-02', 'voice-03', 'emotional-01', 'fitness-01', 'goals-01'].map(
        (id) => slotForCase(id, 'warmth'),
      ),
    );
    expect(slots.size).toBe(2);
  });
});

describe('tallyVerdicts', () => {
  const verdict = (winner: JudgeVerdict['winner']): JudgeVerdict => ({
    dimension: 'warmth',
    winner,
    reason: 'x',
  });

  it('counts wins, losses and ties', () => {
    const tally = tallyVerdicts([
      verdict('candidate'),
      verdict('candidate'),
      verdict('tie'),
      verdict('baseline'),
    ]);
    expect(tally).toMatchObject({ candidateWins: 2, baselineWins: 1, ties: 1, total: 4 });
    expect(tally.winOrTieRate).toBeCloseTo(0.75);
  });

  it('treats an empty run as vacuously passing rather than dividing by zero', () => {
    expect(tallyVerdicts([]).winOrTieRate).toBe(1);
  });

  it('reaches the Phase 3 gate only with no losses', () => {
    const clean = tallyVerdicts([verdict('candidate'), verdict('tie'), verdict('tie')]);
    expect(clean.winOrTieRate).toBe(1);
    expect(clean.baselineWins).toBe(0);
  });
});
