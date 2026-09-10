import { z } from 'zod';
import type { CocoBudgetStore } from './budget';
import {
  cocoContextSnapshotSchema,
  cocoActionNameSchema,
  cocoModelOutputSchema,
  cocoModeSchema,
  cocoSafetyResultSchema,
  type CocoActionName,
  type CocoContextSnapshot,
  type CocoMode,
  type CocoModelOutput,
  type CocoRequest,
  type CocoResponse,
} from './contracts';
import { evaluateCocoSafety } from './safety';

export type CocoProviderRequest = {
  requestId: string;
  userId: string;
  mode: CocoMode;
  message: string;
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

function fallbackOutput(
  request: CocoRequest,
  reason: 'fallback' | 'budget',
): CocoModelOutput {
  const next = request.context.recommendedAction;
  const message =
    reason === 'budget'
      ? `Mus's AI limit is resting for today. Your next grounded step is still: ${next.title}.`
      : `I couldn't reach Mus's AI right now. We can still take one clear step: ${next.title}.`;
  return {
    message,
    tone: request.mode === 'focus' || request.mode === 'workout' ? 'firm' : 'balanced',
    proposals: [],
    citations: next.recordId
      ? [
          {
            recordType: next.kind === 'task' ? 'task' : 'routine',
            recordId: next.recordId,
            label: next.title,
          },
        ]
      : [],
  };
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => { onTimeout(); reject(new CocoRouterError('timeout', 'Coco provider timed out')); },
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
    const safety = evaluateCocoSafety(request.message);

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
      const response = withSafety(
        {
          message: safety.message ?? 'Please seek appropriate support now.',
          tone: 'gentle',
          proposals: [],
          citations: [],
        },
        safety,
      );
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
      response: withSafety(fallbackOutput(request, 'fallback'), safety),
    };
  };
}
