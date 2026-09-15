import { allowanceRejection, reserveWebAiRequest } from '@/lib/server-ai-allowance';
import { NextResponse } from 'next/server';
import { AiBudgetError, AiConfigError, completeObject } from '@kayamo/ai';
import { getAgentSpendUsd, insertAgentRunTelemetry } from '@kayamo/db';
import {
  bindConsultToCatalog,
  catalogPromptLines,
  gymConsultSchema,
} from '@kayamo/features/gym';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';

const requestSchema = z
  .object({
    logicalDate: z.string().date(),
    note: z.string().trim().max(280).optional(),
    recentLifts: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  })
  .strict();

function nonnegativeEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function gymModelId(): string {
  return process.env.MODEL_GYM?.trim() || process.env.MUS_ORCHESTRATOR_MODEL?.trim() || process.env.MODEL_SMALL?.trim() || 'gpt-5.6-luna';
}

const GYM_CONSULT_SYSTEM = `You assemble one gym session using the supplied exercise catalog and the user's stated equipment. Do not assume a country or gym type.

Pick 4 to 6 lifts. slug is the only identifier you may output — copy it exactly from the catalog.
Never invent a slug, name, or machine. Prefer compounds first, then isolation. Cover one split (push, pull, legs, or a short full-body if the note asks).
Balance movement patterns (for example horizontal push + vertical push on a push day). Prefer ai-allowed rows.
If the note is empty, infer a split from recent lift names and do not copy the last session.
No nutrition numbers. No medical claims. No shame copy.

Catalog (slug | name | pattern | muscle | mechanic | group | equipment | tracking | difficulty):
${catalogPromptLines()}`;

export async function POST(request: Request) {
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to consult a session.' }, { status: 401 });
  }

  const allowanceError = allowanceRejection(await reserveWebAiRequest(user.id));
  if (allowanceError) return allowanceError;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid gym consult request.' }, { status: 400 });
  }

  const dailyBudgetUsd = nonnegativeEnvNumber('AI_DAILY_BUDGET_USD_PER_USER', 0.05);
  const estimatedRequestCostUsd = nonnegativeEnvNumber('AI_ESTIMATED_REQUEST_USD', 0.01);
  const started = Date.now();
  const modelId = gymModelId();

  try {
    const raw = await completeObject(
      {
        tier: 'coach',
        schema: gymConsultSchema,
        system: GYM_CONSULT_SYSTEM,
        userId: user.id,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              note: parsed.data.note ?? null,
              recentLifts: parsed.data.recentLifts ?? [],
            }),
          },
        ],
      },
      {
        modelId,
        budget: {
          dailyBudgetUsd,
          estimatedRequestCostUsd,
          spentUsd: () =>
            getAgentSpendUsd(supabase, {
              userId: user.id,
              logicalDate: parsed.data.logicalDate,
            }),
          recordUsage: async (usage) => {
            await insertAgentRunTelemetry(supabase, {
              id: crypto.randomUUID(),
              userId: user.id,
              requestId: crypto.randomUUID(),
              logicalDate: parsed.data.logicalDate,
              trigger: 'gym_consult',
              model: modelId,
              inputTokens: 0,
              outputTokens: 0,
              costUsd: usage.costUsd,
              latencyMs: usage.latencyMs,
              outcome: 'model',
              errorCode: '',
              updatedAt: new Date().toISOString(),
              agent: 'gym_consult',
            });
          },
        },
      },
    );

    const bound = bindConsultToCatalog(raw);
    if (bound.picks.length < 3) {
      return NextResponse.json(
        { error: 'Consult did not land on the library. Pick from the list.' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      consult: {
        splitLabel: bound.splitLabel,
        rationale: bound.rationale,
        picks: bound.picks.map((pick) => ({
          slug: pick.exercise.slug,
          sets: pick.sets,
          reps: pick.reps,
          why: pick.why,
        })),
      },
    });
  } catch (error) {
    if (error instanceof AiBudgetError) {
      return NextResponse.json(
        { error: "Today's AI limit is resting. Search the list instead." },
        { status: 429 },
      );
    }
    if (error instanceof AiConfigError) {
      return NextResponse.json({ error: 'Gym consult is not configured.' }, { status: 503 });
    }
    void insertAgentRunTelemetry(supabase, {
      id: crypto.randomUUID(),
      userId: user.id,
      requestId: crypto.randomUUID(),
      logicalDate: parsed.data.logicalDate,
      trigger: 'gym_consult',
      model: modelId,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - started,
      outcome: 'fallback',
      errorCode: 'gym_consult_failed',
      updatedAt: new Date().toISOString(),
      agent: 'gym_consult',
    }).catch(() => undefined);
    return NextResponse.json({ error: 'Could not consult. Pick from the list.' }, { status: 502 });
  }
}
