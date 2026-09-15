import { z } from 'zod';
import type { CocoBudgetStore } from './budget';
import {
  cocoContextSnapshotSchema,
  cocoActionNameSchema,
  cocoModelOutputSchema,
  cocoModeSchema,
  cocoSafetyResultSchema,
  cocoHistoryTurnSchema,
  type CocoActionName,
  type CocoHistoryTurn,
  type CocoContextSnapshot,
  type CocoMode,
  type CocoModelOutput,
  type CocoRequest,
  type CocoResponse,
} from './contracts';
import { permissionDomainForAction } from './allowed-actions';
import { CONTEXT_LIMITS, truncateWords } from './context-limits';
import type { MusContextPermissionDomain } from './context-permissions';
import { evaluateCocoSafety } from './safety';

export type CocoProviderRequest = {
  requestId: string;
  userId: string;
  mode: CocoMode;
  message: string;
  /** Prior turns, oldest first. Already clamped. See cocoHistoryTurnSchema. */
  history: CocoHistoryTurn[];
  context: CocoContextSnapshot;
  maxOutputTokens: number;
  abortSignal?: AbortSignal;
};

export type CocoProviderResult = {
  output: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export interface CocoProvider {
  generate(request: CocoProviderRequest): Promise<CocoProviderResult>;
}

export type CocoTelemetryEvent = {
  requestId: string;
  userId: string;
  trigger: CocoMode;
  logicalDate: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  outcome: 'model' | 'fallback' | 'safety' | 'budget';
  errorCode:
    | 'none'
    | 'timeout'
    | 'provider'
    | 'invalid_output'
    | 'unauthorized_action'
    | 'unauthorized_context';
};

export interface CocoTelemetrySink {
  record(event: CocoTelemetryEvent): Promise<void>;
}

export type CocoRouterConfig = {
  dailyBudgetUsd: number;
  estimatedRequestCostUsd: number;
  maxOutputTokens: number;
  maxRetries: number;
  timeoutMs: number;
};

export type CocoRouterResult = {
  source: 'model' | 'fallback' | 'safety' | 'budget';
  response: CocoResponse;
};

const requestSchema = z
  .object({
    requestId: z.string().min(1).max(100),
    userId: z.string().min(1).max(200),
    mode: cocoModeSchema,
    message: z.string().max(5000),
    context: cocoContextSnapshotSchema,
    allowedActions: z.array(cocoActionNameSchema),
    history: z.array(cocoHistoryTurnSchema).max(CONTEXT_LIMITS.historyTurnsAccepted).optional(),
  })
  .strict();

const DEFAULT_CONFIG: CocoRouterConfig = {
  dailyBudgetUsd: 0.05,
  estimatedRequestCostUsd: 0.01,
  maxOutputTokens: 700,
  maxRetries: 1,
  timeoutMs: 15_000,
};

const LOCAL_ONLY_MODES = new Set<CocoMode>(['vent', 'diary', 'prayer']);

class CocoRouterError extends Error {
  constructor(
    readonly code: CocoTelemetryEvent['errorCode'],
    message: string,
    /** Set when a proposal was refused, so the reply can name the permission. */
    readonly action?: CocoActionName,
  ) {
    super(message);
  }
}

function authorizeOutput(
  output: CocoModelOutput,
  allowedActions: CocoActionName[],
  context: CocoContextSnapshot,
): CocoModelOutput {
  const allowed = new Set(allowedActions);
  for (const proposal of output.proposals) {
    if (!allowed.has(proposal.action)) {
      throw new CocoRouterError(
        'unauthorized_action',
        `Model proposed disallowed action ${proposal.action}`,
        proposal.action,
      );
    }
    if (!proposal.requiresConfirmation) {
      throw new CocoRouterError('unauthorized_action', 'Proposal lacked confirmation');
    }
  }
  const citedRecords = new Set([
    ...context.tasks.map((row) => `task:${row.id}`),
    ...context.routines.map((row) => `routine:${row.id}`),
    ...context.goals.map((row) => `goal:${row.id}`),
    ...(context.companion?.achievements ?? []).map((row) => `achievement:${row.id}`),
    ...context.memories.map((row) => `memory:${row.id}`),
    ...(context.health.confirmedWorkouts ?? []).map((row) => `workout:${row.id}`),
    ...(context.permissions.faith ? (context.scripture ?? []) : []).map(
      (row) => `scripture:${row.id}`,
    ),
    ...(context.health.nutritionGuidance
      ? [
          `target:${context.health.nutritionGuidance.targetId}`,
          `expenditure:${context.health.nutritionGuidance.expenditureId}`,
        ]
      : []),
  ]);
  for (const citation of output.citations) {
    if (!citedRecords.has(`${citation.recordType}:${citation.recordId}`)) {
      throw new CocoRouterError(
        'unauthorized_context',
        'Model cited a record outside the permitted context',
      );
    }
  }
  return output;
}

/** What each domain unlocks, in the user's words, for a refusal message. */
const PERMISSION_ASK: Record<MusContextPermissionDomain, string> = {
  physical_self: 'your food, nutrition and workouts',
  goals_planning: 'your goals and planning',
  memory: 'your saved memories',
  faith: 'your faith context',
};

function fallbackOutput(
  request: CocoRequest,
  reason: 'fallback' | 'budget',
  error?: unknown,
): CocoModelOutput {
  const next = request.context.recommendedAction;
  // A refusal is not an outage. When the guard rejected a proposal because the
  // domain is switched off, say which switch — the remedy is one toggle away
  // and the old copy sent people looking for a network problem instead.
  const deniedAction =
    error instanceof CocoRouterError && error.code === 'unauthorized_action'
      ? error.action
      : undefined;
  const deniedDomain = deniedAction ? permissionDomainForAction(deniedAction) : null;
  const message =
    reason === 'budget'
      ? `Lis's AI limit is resting for today. Your next grounded step is still: ${next.title}.`
      : deniedDomain
        ? `I would need access to ${PERMISSION_ASK[deniedDomain]} before I can do that. You can turn it on under Context access.`
        : deniedAction
          // Refused, but not for want of a permission: the action is simply not
          // one this screen offers. Still a refusal, and still not an outage —
          // saying "I could not reach Lis" here sends people to look for a
          // problem that does not exist, which is the bug this branch exists
          // to stop.
          ? `That is not something I can do from here. The next clear step is still: ${next.title}.`
          : `I could not reach Lis right now. We can still take one clear step: ${next.title}.`;
  return {
    message,
    tone: request.mode === 'focus' || request.mode === 'workout' ? 'firm' : 'balanced',
    proposals: [],
    citations:
      next.recordId && (next.kind === 'task' || next.kind === 'routine')
        ? [{ recordType: next.kind, recordId: next.recordId, label: next.title }]
        : [],
  };
}

/**
 * Keep the most recent turns and cut each to length. Clamped rather than
 * rejected: a long conversation is normal, and dropping the request because
 * turn nine exists would be the same class of bug as the memories cap.
 */
export function clampHistory(history: CocoHistoryTurn[] | undefined): CocoHistoryTurn[] {
  if (!history?.length) return [];
  return history.slice(-CONTEXT_LIMITS.historyTurns).map((turn) => ({
    role: turn.role,
    content: truncateWords(turn.content, CONTEXT_LIMITS.historyTurnChars),
  }));
}

function localOnlyOutput(request: CocoRequest): CocoModelOutput {
  const message =
    request.mode === 'vent'
      ? "I'm here with you. This stays on this device. You can name what feels heaviest without fixing everything right now."
      : request.mode === 'prayer'
        ? 'This prayer stays on this device. Take your time; it does not need to sound polished.'
        : 'This entry stays on this device. Write honestly; nothing here is sent to the AI.';
  return { message, tone: 'gentle', proposals: [], citations: [] };
}

function withSafety(
  output: CocoModelOutput,
  safety: ReturnType<typeof evaluateCocoSafety>,
): CocoResponse {
  return { ...output, safety: cocoSafetyResultSchema.parse(safety) };
}

/**
 * The deterministic crisis reply. Exported because the route evaluates safety
 * before it reserves an AI request — this response costs no tokens and must
 * never be gated behind a quota — and both callers have to produce the exact
 * same shape.
 */
export function cocoSafetyResponse(
  safety: ReturnType<typeof evaluateCocoSafety>,
): CocoResponse {
  return withSafety(
    {
      message: safety.message ?? 'Please seek appropriate support now.',
      tone: 'gentle',
      proposals: [],
      citations: [],
    },
    safety,
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => { onTimeout(); reject(new CocoRouterError('timeout', 'Lis provider timed out')); },
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorCode(error: unknown): CocoTelemetryEvent['errorCode'] {
  if (error instanceof CocoRouterError) return error.code;
  if (error instanceof z.ZodError) return 'invalid_output';
  return 'provider';
}

export function createCocoRouter(deps: {
  provider: CocoProvider;
  budget: CocoBudgetStore;
  telemetry?: CocoTelemetrySink;
  config?: Partial<CocoRouterConfig>;
}) {
  const config = { ...DEFAULT_CONFIG, ...deps.config };

  return async function routeCoco(unparsed: CocoRequest): Promise<CocoRouterResult> {
    const request = requestSchema.parse(unparsed) as CocoRequest;
    const started = Date.now();
    // Region comes from the profile timezone the snapshot already carries, so
    // the support footer names numbers the user can actually dial.
    const safety = evaluateCocoSafety(request.message, {
      timezone: request.context.timezone,
    });

    const record = async (
      event: Omit<
        CocoTelemetryEvent,
        'requestId' | 'userId' | 'trigger' | 'logicalDate' | 'latencyMs'
      >,
    ) => {
      try {
        await deps.telemetry?.record({
          requestId: request.requestId,
          userId: request.userId,
          trigger: request.mode,
          logicalDate: request.context.logicalDate,
          latencyMs: Date.now() - started,
          ...event,
        });
      } catch {
        // Operational telemetry must never break the user response.
      }
    };

    if (!safety.allowModel) {
      const response = cocoSafetyResponse(safety);
      await record({
        model: 'deterministic-safety',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        outcome: 'safety',
        errorCode: 'none',
      });
      return { source: 'safety', response };
    }

    if (LOCAL_ONLY_MODES.has(request.mode)) {
      const response = withSafety(localOnlyOutput(request), safety);
      await record({
        model: 'local-only',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        outcome: 'fallback',
        errorCode: 'none',
      });
      return { source: 'fallback', response };
    }

    const spent = await deps.budget.spentUsd(request.userId, request.context.logicalDate);
    if (spent + config.estimatedRequestCostUsd > config.dailyBudgetUsd) {
      const response = withSafety(fallbackOutput(request, 'budget'), safety);
      await record({
        model: 'deterministic-budget',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        outcome: 'budget',
        errorCode: 'none',
      });
      return { source: 'budget', response };
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      try {
        const result = await withTimeout(
          deps.provider.generate({
            requestId: request.requestId,
            userId: request.userId,
            mode: request.mode,
            message: request.message,
            history: clampHistory(request.history),
            context: request.context,
            maxOutputTokens: config.maxOutputTokens,
            abortSignal: controller.signal,
          }),
          config.timeoutMs,
          () => controller.abort(),
        );
        const output = authorizeOutput(
          cocoModelOutputSchema.parse(result.output),
          request.allowedActions,
          request.context,
        );
        await deps.budget.recordUsage({
          userId: request.userId,
          logicalDate: request.context.logicalDate,
          requestId: request.requestId,
          costUsd: result.costUsd,
        });
        await record({
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costUsd,
          outcome: 'model',
          errorCode: 'none',
        });
        return { source: 'model', response: withSafety(output, safety) };
      } catch (error) {
        lastError = error;
      } finally {
        controller.abort();
      }
    }

    await record({
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      outcome: 'fallback',
      errorCode: errorCode(lastError),
    });
    return {
      source: 'fallback',
      response: withSafety(fallbackOutput(request, 'fallback', lastError), safety),
    };
  };
}
