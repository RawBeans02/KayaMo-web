/**
 * Gate for the live eval tier.
 *
 * Mirrors `isDbIntegrationConfigured` in `packages/db/src/env.ts`: the live
 * file sits inside the ordinary `src/**\/*.test.ts` glob and runs — skipped —
 * on every `pnpm test`. No new runner, no new vitest project, no CI change, and
 * no repository secret until someone decides to add one.
 *
 * Run it deliberately with `pnpm --filter @kayamo/ai eval:live`.
 */
export function isKaiEvalConfigured(): boolean {
  return (
    Boolean(process.env.KAI_EVAL_LIVE?.trim()) &&
    Boolean(process.env.OPENAI_API_KEY?.trim())
  );
}

/** Human-readable reason, printed when the live tier skips. */
export function kaiEvalSkipReason(): string {
  if (!process.env.KAI_EVAL_LIVE?.trim()) return 'KAI_EVAL_LIVE is not set';
  if (!process.env.OPENAI_API_KEY?.trim()) return 'OPENAI_API_KEY is not set';
  return 'configured';
}
