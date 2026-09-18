import { reserveWebAiRequest } from '@/lib/server-ai-allowance';
import { json, requireUser } from '@/lib/api';
import type { CocoProvider } from '@kayamo/ai';
import { createOpenAICocoProvider } from '@kayamo/ai/server';
import {
  getAgentSpendUsd,
  getProfileTimezone,
  insertAgentRunTelemetry,
} from '@kayamo/db';
import { handleMusRespond } from '@kayamo/features/mus-respond';
import { readAiBudgetEnv } from '@kayamo/features/mus-plan-server';

function configuredProvider(): CocoProvider {
  try {
    return createOpenAICocoProvider();
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'unknown';
    console.error(`Lis provider configuration failed (${detail}).`);
    return {
      generate: async () => {
        throw new Error('Lis provider is unavailable');
      },
    };
  }
}

/** Auth and wiring only; the turn itself lives in `handleMusRespond`. */
export async function POST(request: Request) {
  const auth = await requireUser(request, 'Sign in to talk with Lis.');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const result = await handleMusRespond({
    client: supabase,
    userId: user.id,
    body: await request.json().catch(() => null),
    provider: configuredProvider(),
    reserveAllowance: reserveWebAiRequest,
    readTimezone: (userId) => getProfileTimezone(supabase, userId),
    spentUsd: (userId, logicalDate) =>
      getAgentSpendUsd(supabase, { userId, logicalDate }),
    telemetry: {
      record: (event) =>
        insertAgentRunTelemetry(supabase, {
          id: crypto.randomUUID(),
          userId: event.userId,
          requestId: event.requestId,
          logicalDate: event.logicalDate,
          trigger: event.trigger,
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          costUsd: event.costUsd,
          latencyMs: event.latencyMs,
          outcome: event.outcome,
          errorCode: event.errorCode,
          updatedAt: new Date().toISOString(),
        }),
    },
    config: {
      maxRetries: 0,
      dailyBudgetUsd: readAiBudgetEnv().dailyBudgetUsd,
      estimatedRequestCostUsd: readAiBudgetEnv().estimatedRequestCostUsd,
    },
  });

  return json(result.body, { status: result.status });
}
