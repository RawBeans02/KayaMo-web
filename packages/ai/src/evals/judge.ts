import { z } from 'zod';
import { completeObject, type CompleteObjectDeps } from '../router';

/**
 * Pairwise voice judge.
 *
 * Deliberately NOT an absolute 1–5 rubric. Absolute scores are noisy, they
 * drift when the judge model changes, and a threshold like "≥ 4.0" cannot
 * answer the only question that matters — did this change help? A pairwise
 * comparison against a frozen baseline can, and it survives a judge upgrade
 * because both sides move together.
 *
 * The judge sees one dimension at a time. Asking for warmth, concreteness and
 * preachiness in a single call reliably collapses into one overall impression.
 *
 * All the plumbing here — shuffling, unmapping, aggregation — is a pure
 * function of an injected `generateObject`, so it is unit-tested in the
 * deterministic tier without spending anything.
 */

export const JUDGE_DIMENSIONS = ['warmth', 'concreteness', 'non_preachy'] as const;
export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];

const DIMENSION_QUESTION: Record<JudgeDimension, string> = {
  warmth:
    'Which reply sounds more like a person who knows the user and is on their side, rather than a service?',
  concreteness:
    'Which reply is more concrete and useful — naming a specific next thing rather than giving general advice?',
  non_preachy:
    'Which reply is less preachy — which one avoids lecturing, moralising, or explaining what is important?',
};

const verdictSchema = z
  .object({
    winner: z.enum(['A', 'B', 'tie']),
    reason: z.string().trim().min(1).max(280),
  })
  .strict();

export type JudgeVerdict = {
  dimension: JudgeDimension;
  /** Resolved back to the caller's labels, after the shuffle is undone. */
  winner: 'baseline' | 'candidate' | 'tie';
  reason: string;
};

const JUDGE_SYSTEM = `You compare two replies from a wellbeing assistant and pick the better one on a single named dimension.

Judge only the dimension you are asked about. Ignore formatting, length and factual accuracy unless they bear on that dimension. If the two are genuinely close, answer "tie" — ties are a useful answer, not a failure. Give one sentence of reasoning.`;

export type JudgeInput = {
  userMessage: string;
  baseline: string;
  candidate: string;
  dimension: JudgeDimension;
  /**
   * Which slot the candidate occupies. Position bias is real and large in
   * pairwise judging; the caller varies this per case so it cancels out.
   */
  candidateSlot: 'A' | 'B';
  userId: string;
};

export async function judgePair(
  input: JudgeInput,
  deps: CompleteObjectDeps = {},
): Promise<JudgeVerdict> {
  const candidateIsA = input.candidateSlot === 'A';
  const replyA = candidateIsA ? input.candidate : input.baseline;
  const replyB = candidateIsA ? input.baseline : input.candidate;

  const verdict = await completeObject(
    {
      tier: 'small',
      schema: verdictSchema,
      system: JUDGE_SYSTEM,
      userId: input.userId,
      messages: [
        {
          role: 'user',
          content: [
            `Dimension: ${input.dimension}`,
            DIMENSION_QUESTION[input.dimension],
            '',
            `The user said: ${input.userMessage}`,
            '',
            `Reply A: ${replyA}`,
            '',
            `Reply B: ${replyB}`,
          ].join('\n'),
        },
      ],
    },
    deps,
  );

  return {
    dimension: input.dimension,
    winner:
      verdict.winner === 'tie'
        ? 'tie'
        : (verdict.winner === 'A') === candidateIsA
          ? 'candidate'
          : 'baseline',
    reason: verdict.reason,
  };
}

/** Deterministic slot assignment: same case id always lands the same way. */
export function slotForCase(caseId: string, dimension: JudgeDimension): 'A' | 'B' {
  let hash = 0;
  for (const char of `${caseId}:${dimension}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % 2 === 0 ? 'A' : 'B';
}

export type JudgeTally = {
  candidateWins: number;
  baselineWins: number;
  ties: number;
  total: number;
  /** Wins plus ties, as a fraction. The Phase 3 gate is ≥ 0.8 with no losses. */
  winOrTieRate: number;
};

export function tallyVerdicts(verdicts: readonly JudgeVerdict[]): JudgeTally {
  const candidateWins = verdicts.filter((v) => v.winner === 'candidate').length;
  const baselineWins = verdicts.filter((v) => v.winner === 'baseline').length;
  const ties = verdicts.filter((v) => v.winner === 'tie').length;
  const total = verdicts.length;
  return {
    candidateWins,
    baselineWins,
    ties,
    total,
    winOrTieRate: total === 0 ? 1 : (candidateWins + ties) / total,
  };
}
