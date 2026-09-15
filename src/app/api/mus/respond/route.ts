import { reserveWebAiRequest } from '@/lib/server-ai-allowance';
import { NextResponse } from 'next/server';
import type { CocoProvider } from '@kayamo/ai';
import { createOpenAICocoProvider } from '@kayamo/ai/server';
import {
  getAgentSpendUsd,
  getProfileTimezone,
  insertAgentRunTelemetry,
} from '@kayamo/db';
import { handleMusRespond } from '@kayamo/features/mus-respond';
import { createServerSupabase } from '@/lib/supabase/server';

function nonnegativeEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

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
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to talk with Lis.' }, { status: 401 });
  }

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
      dailyBudgetUsd: nonnegativeEnvNumber('AI_DAILY_BUDGET_USD_PER_USER', 0.05),
      estimatedRequestCostUsd: nonnegativeEnvNumber('AI_ESTIMATED_REQUEST_USD', 0.01),
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
