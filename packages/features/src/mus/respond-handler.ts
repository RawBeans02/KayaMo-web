import {
  CONTEXT_LIMITS,
  allowedMusActions,
  cocoHistoryTurnSchema,
  cocoSafetyResponse,
  createCocoRouter,
  evaluateCocoSafety,
  musEntrySchema,
  type CocoProvider,
  type CocoRouterConfig,
  type CocoRouterResult,
  type CocoTelemetrySink,
} from '@kayamo/ai';
import { z } from 'zod';
import { buildServerMusContext } from './server-context';
import type { DbClient } from '@kayamo/db';

/**
 * The Lis chat turn, lifted out of the Next route so the ordering below is a
 * testable sequence rather than something you have to read the route to know.
 *
 * The order is the whole point. It used to be:
 *
 *     auth → reserve allowance → parse → context → route
 *
 * which put two things behind a spend limit that have no business being there.
 * A malformed request burned one of five daily slots and came back "Invalid Lis
 * request", and — far worse — `evaluateCocoSafety` lives inside `routeCoco`, so
 * a user in crisis on their sixth message of the day was told "Your AI request
 * allowance is used for today" instead of being shown a crisis line. The safety
 * response is deterministic, costs zero tokens and never reaches a provider.
 *
 * It is now:
 *
 *     auth → parse → safety → allowance → context → route
 */

const requestSchema = z
  .object({
    requestId: z.string().min(1).max(100),
    mode: z.enum(['chat', 'focus', 'workout']),
    message: z.string().trim().min(1).max(5000),
    logicalDate: z.string().date(),
    entry: musEntrySchema.optional(),
    // The client sends the tail of the thread it already holds. See
    // cocoHistoryTurnSchema: this is a UX input, never an authority.
    history: z.array(cocoHistoryTurnSchema).max(CONTEXT_LIMITS.historyTurnsAccepted).optional(),
  })
  .strict();

export type MusRespondRequest = z.infer<typeof requestSchema>;

/** Outcome of reserving one metered AI request. */
export type AllowanceOutcome =
  | { ok: true }
  | { ok: false; status: 429 | 503; error: string };

export type MusRespondResult = {
  status: number;
  body: CocoRouterResult | { error: string };
};

export type MusRespondDeps = {
  client: DbClient;
  userId: string;
  /** Raw JSON body; parsing and its 400 are this handler's job. */
  body: unknown;
  provider: CocoProvider;
  reserveAllowance: (userId: string) => Promise<AllowanceOutcome>;
  spentUsd: (userId: string, logicalDate: string) => Promise<number>;
  telemetry?: CocoTelemetrySink;
  config?: Partial<CocoRouterConfig>;
  /** Injected in tests; the profile timezone selects the crisis-line region. */
  readTimezone?: (userId: string) => Promise<string | null>;
  /** Injected in tests so the turn can be exercised without a database. */
  buildContext?: typeof buildServerMusContext;
};

export async function handleMusRespond(
  deps: MusRespondDeps,
): Promise<MusRespondResult> {
  const parsed = requestSchema.safeParse(deps.body);
  if (!parsed.success) {
    return { status: 400, body: { error: 'Invalid Lis request.' } };
  }
  const input = parsed.data;

  // Timezone only — a single indexed lookup, deliberately not the full context,
  // because everything below this point may be skipped.
  const timezone = deps.readTimezone
    ? await deps.readTimezone(deps.userId).catch(() => null)
    : null;

  const safety = evaluateCocoSafety(input.message, { timezone });
  if (!safety.allowModel) {
    await recordSafety(deps, input);
    return {
      status: 200,
      body: { source: 'safety', response: cocoSafetyResponse(safety) },
    };
  }

  const allowance = await deps.reserveAllowance(deps.userId);
  if (!allowance.ok) {
    return { status: allowance.status, body: { error: allowance.error } };
  }

  const buildContext = deps.buildContext ?? buildServerMusContext;
  const { context } = await buildContext({
    client: deps.client,
    userId: deps.userId,
    logicalDate: input.logicalDate,
  });
  const contextWithEntry = input.entry ? { ...context, entry: input.entry } : context;

  const routeCoco = createCocoRouter({
    provider: deps.provider,
    budget: {
      spentUsd: deps.spentUsd,
      recordUsage: async () => undefined,
    },
    telemetry: deps.telemetry,
    config: deps.config,
  });

  try {
    const result = await routeCoco({
      requestId: input.requestId,
      userId: deps.userId,
      mode: input.mode,
      message: input.message,
      history: input.history,
      context: contextWithEntry,
      allowedActions: allowedMusActions({
        mode: input.mode,
        entry: input.entry,
        permissions: contextWithEntry.permissions,
      }),
    });
    return { status: 200, body: result };
  } catch (error) {
    // `routeCoco` parses the snapshot before its own try block, so a context
    // that violates the contract used to escape as an unhandled 500 and take
    // Lis down for that user until the offending row changed. The clamp in
    // `buildAuthorizedCocoContext` should prevent it; this is the net.
    if (error instanceof z.ZodError) {
      return {
        status: 200,
        body: {
          source: 'fallback',
          response: cocoSafetyResponse({ ...safety, message: CONTEXT_TOO_LARGE }),
        },
      };
    }
    throw error;
  }
}

const CONTEXT_TOO_LARGE =
  'I could not read your records cleanly just now. Nothing was changed, and manual tracking still works.';

async function recordSafety(
  deps: MusRespondDeps,
  input: MusRespondRequest,
): Promise<void> {
  try {
    await deps.telemetry?.record({
      requestId: input.requestId,
      userId: deps.userId,
      trigger: input.mode,
      logicalDate: input.logicalDate,
      model: 'deterministic-safety',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      outcome: 'safety',
      errorCode: 'none',
    });
  } catch {
    // Operational telemetry must never break a crisis response.
  }
}
