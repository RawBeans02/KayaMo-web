import { describe, expect, it, vi } from 'vitest';
// `openai-provider.ts` is `import 'server-only'`, which throws outside a server
// component. Stub it so the live tier can import the real provider at all.
vi.mock('server-only', () => ({}));
import { InMemoryCocoBudgetStore } from '../budget';
import { createCocoRouter, type CocoRouterResult } from '../coco-router';
import { LIS_EVAL_CASES } from './cases';
import { baselineContext } from './doubles';
import { isLisEvalConfigured, lisEvalSkipReason } from './env';
import { loadRootEnv } from './load-root-env';
import { checkVoiceBounds, findRobotTells, measureVoice } from './rubric';
import { readBaseline, writeBaseline } from './baselines';

/**
 * Tier 2 — the live tier. Spends real money, so it is opt-in:
 *
 *     pnpm --filter @kayamo/ai eval:live
 *
 * It sits inside the ordinary `src/**\/*.test.ts` glob and skips on every
 * normal run, exactly like `sync-database.integration.test.ts`. That means no
 * new vitest project, no CI change, and no repository secret until someone
 * decides to add one.
 *
 * Set LIS_EVAL_RECORD=1 to write the replies to `baselines/` instead of
 * asserting against them. Recording is a deliberate, reviewable act — there is
 * no snapshot `-u` here that can silently bless a worse reply.
 */

// Module body runs after imports, so this lands before the gate is evaluated.
// vitest does not read .env.local the way Next does at runtime.
loadRootEnv();

const describeLive = isLisEvalConfigured() ? describe : describe.skip;
const RECORDING = Boolean(process.env.LIS_EVAL_RECORD?.trim());

if (!isLisEvalConfigured()) {
  console.info(`[lis-eval] live tier skipped: ${lisEvalSkipReason()}`);
}

describeLive('Lis live voice baseline', () => {
  // Built on first use, not at collection: `describe.skip` still runs this
  // callback, and constructing the provider without a key throws.
  let cached: ((request: Parameters<ReturnType<typeof createCocoRouter>>[0]) => Promise<CocoRouterResult>) | null =
    null;
  async function route(request: Parameters<ReturnType<typeof createCocoRouter>>[0]) {
    if (!cached) {
      const { createOpenAICocoProvider } = await import('../openai-provider');
      cached = createCocoRouter({
        provider: createOpenAICocoProvider(),
        budget: new InMemoryCocoBudgetStore(),
        config: { maxRetries: 0, dailyBudgetUsd: 5, timeoutMs: 30_000 },
      });
    }
    return cached(request);
  }

  /** Cases the deterministic tier cannot answer: these need real generation. */
  const liveCases = LIS_EVAL_CASES.filter((c) => c.expect.source !== 'safety');

  it.each(liveCases.map((c) => [c.id, c] as const))(
    '%s',
    async (id, testCase) => {
      const context = baselineContext(testCase.context);
      const result = await route({
        requestId: id,
        userId: 'lis-eval',
        mode: testCase.mode,
        message: testCase.message,
        ...(testCase.history ? { history: testCase.history } : {}),
        context,
        allowedActions: testCase.allowedActions ?? ['create_task', 'start_focus'],
      });

      const message = result.response.message;

      if (RECORDING) {
        await writeBaseline(id, {
          caseId: id,
          reply: message,
          source: result.source,
          recordedAt: new Date().toISOString(),
        });
        return;
      }

      if (testCase.expect.source) {
        expect(result.source, `${id} routed to ${result.source}`).toBe(
          testCase.expect.source,
        );
      }
      for (const pattern of testCase.expect.mustMatch ?? []) {
        expect(message, `${id} missing ${pattern}`).toMatch(pattern);
      }
      for (const pattern of testCase.expect.mustNotMatch ?? []) {
        expect(message, `${id} matched forbidden ${pattern}`).not.toMatch(pattern);
      }
      if (testCase.expect.bounds) {
        const titles = context.tasks.map((task) => task.title);
        const failures = checkVoiceBounds(
          measureVoice(message, titles),
          testCase.expect.bounds,
        );
        expect(failures, `${id}: ${failures.join('; ')}`).toEqual([]);
      }

      const tells = findRobotTells(message);
      expect(
        tells,
        `${id} sounded like a robot: ${tells.map((t) => `${t.id} (${t.why})`).join(', ')}`,
      ).toEqual([]);
    },
    60_000,
  );

  /**
   * The hypothesis the plan flagged and could not test without this harness:
   * maxOutputTokens is 700 on the Responses API, which counts reasoning tokens.
   * If a low-effort reasoning pass plus a long message is truncating the object,
   * an intermittent quality problem has been surfacing as "I could not reach
   * Lis" — an outage message for a config bug.
   */
  it('does not fall back on the longest realistic prompt', async () => {
    const heavy = baselineContext({
      permissions: {
        goals_planning: true,
        physical_self: true,
        memory: true,
        faith: false,
        identity: false,
      },
      tasks: Array.from({ length: 50 }, (_, i) => ({
        id: `task-${i}`,
        title: `A task with a reasonably long descriptive title, number ${i}`,
        completed: false,
        dueAt: null,
      })),
      memories: Array.from({ length: 12 }, (_, i) => ({
        id: `mem-${i}`,
        kind: 'context',
        content: `A remembered preference of moderate length, number ${i}.`,
      })),
    });

    const result = await route({
      requestId: 'truncation-probe',
      userId: 'lis-eval',
      mode: 'chat',
      message: 'given everything on my plate, what should i actually do first today',
      context: heavy,
      allowedActions: ['create_task', 'complete_task', 'start_focus'],
    });

    expect(
      result.source,
      'A full context fell back. If this is reproducible, 700 output tokens is ' +
        'too low and users are seeing an outage message for a truncated object.',
    ).toBe('model');
  }, 60_000);

  it('has a recorded baseline for every live case once recording has run', async () => {
    if (RECORDING) return;
    const missing: string[] = [];
    for (const testCase of liveCases) {
      if ((await readBaseline(testCase.id)) === null) missing.push(testCase.id);
    }
    expect(
      missing,
      `Run LIS_EVAL_RECORD=1 pnpm --filter @kayamo/ai eval:live to record: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});
