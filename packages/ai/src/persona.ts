import { createHash } from 'node:crypto';
import type { CocoContextSnapshot } from './contracts';

/**
 * Lis's voice, and the per-user block that tells Lis who it is speaking with.
 *
 * `packages/ai/README.md` has claimed this file exists since the beginning; it
 * did not. The prompt lived as a template literal inside `openai-provider.ts`,
 * where nothing could assert on it without reading the file as text.
 *
 * WHAT THIS FILE IS NOT, YET: the base persona below is the *existing* wording,
 * moved here byte for byte and nothing else. It is nine sentences and eight of
 * them are prohibitions; the entire voice specification is the second-to-last
 * clause. That is deliberate for now — the eval baseline has to be recorded
 * against the voice we actually ship before the voice is allowed to change, or
 * "did it get better" has no answer. Rewriting it is Phase 3.
 */

/**
 * Bumped whenever `renderLisBasePersona` changes. A test pins the hash to this
 * number, so the persona cannot drift without the diff saying so out loud and
 * invalidating the recorded baselines on purpose.
 */
export const LIS_PERSONA_VERSION = 2;

const BASE_PERSONA = `You are Lis, KayaMo's supportive AI companion.

Use only the supplied confirmed and authorized context. A domain set to false in context.permissions is unavailable; never infer its stored data from another field. Never invent completed activity, Physical Self data, Scripture, or user memories. Faith content is opt-in: use Scripture only when permissions.faith is true and only quote the exact supplied scripture.text with a scripture citation. Never present generated, paraphrased, or remembered text as a Bible quotation, and never claim theological authority. Nutrition calculation is outside your authority: you may explain only the exact code-derived nutritionGuidance values supplied in context and must cite their target or expenditure record. Propose at most three actions and set requiresConfirmation to true for every proposal. Do not claim an action was executed. Use a gentle tone for reflection, a firm but respectful tone during explicit focus or workout sessions, and a balanced tone otherwise. Never shame missed days.`;

/** The fixed instructions, identical for every user. */
export function renderLisBasePersona(): string {
  return BASE_PERSONA;
}

/** Stable fingerprint of the base persona, pinned by a test to the version. */
export function lisPersonaFingerprint(): string {
  return createHash('sha256').update(renderLisBasePersona(), 'utf8').digest('hex');
}

/**
 * The per-user block: who Lis is speaking with, and how they want to be spoken
 * to. Pure and deterministic — the "What Lis knows about me" screen will render
 * this exact string, so the two can never disagree.
 *
 * Returns '' today because nothing populates it yet. A cold-start user must
 * produce an empty string rather than "the user has not told you anything",
 * which reliably turns the first reply into an interrogation.
 */
export function renderLisIdentityCard(_context: CocoContextSnapshot): string {
  return '';
}

/** What actually goes in the system position. */
export function renderLisSystemPrompt(context: CocoContextSnapshot): string {
  const card = renderLisIdentityCard(context);
  return card ? `${renderLisBasePersona()}\n\n${card}` : renderLisBasePersona();
}
