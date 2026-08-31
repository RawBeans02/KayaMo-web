import { NextResponse } from 'next/server';
import { cocoActionNameSchema, createCocoRouter, musEntrySchema, type CocoProvider } from '@kayamo/ai';
import { createOpenAICocoProvider } from '@kayamo/ai/server';
import { getAgentSpendUsd, insertAgentRunTelemetry } from '@kayamo/db';
import { buildServerMusContext } from '@kayamo/features/mus-server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';

const requestSchema = z
  .object({
    requestId: z.string().min(1).max(100),
    mode: z.enum(['chat', 'focus', 'workout']),
    message: z.string().trim().min(1).max(5000),
    logicalDate: z.string().date(),
    entry: musEntrySchema.optional(),
  })
  .strict();

const ALLOWED_ACTIONS = cocoActionNameSchema.options;

function nonnegativeEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function configuredProvider(): CocoProvider {
  try {
    return createOpenAICocoProvider();
  } catch {
    return {
      generate: async () => {
        throw new Error('Mus provider is unavailable');
      },
    };
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to talk with Mus.' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Mus request.' }, { status: 400 });
  }

  const { context } = await buildServerMusContext({
    client: supabase,
    userId: user.id,
    logicalDate: parsed.data.logicalDate,
  });
  const contextWithEntry = parsed.data.entry
    ? { ...context, entry: parsed.data.entry }
    : context;

  const routeCoco = createCocoRouter({
    provider: configuredProvider(),
    budget: {
      spentUsd: (userId, logicalDate) =>
        getAgentSpendUsd(supabase, { userId, logicalDate }),
      recordUsage: async () => undefined,
    },
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
      dailyBudgetUsd: nonnegativeEnvNumber('AI_DAILY_BUDGET_USD_PER_USER', 0.05),
      estimatedRequestCostUsd: nonnegativeEnvNumber('AI_ESTIMATED_REQUEST_USD', 0.01),
    },
  });

  const result = await routeCoco({
    requestId: parsed.data.requestId,
    userId: user.id,
    mode: parsed.data.mode,
    message: parsed.data.message,
    context: contextWithEntry,
    allowedActions: [...ALLOWED_ACTIONS],
  });
  return NextResponse.json(result);
}
