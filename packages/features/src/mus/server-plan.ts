import { AiBudgetError, AiConfigError, completeObject } from '@kayamo/ai';
import { getAgentSpendUsd, insertAgentRunTelemetry, type DbClient } from '@kayamo/db';
import {
  captureProposalSchema,
  captureTextRequestSchema,
  dayPlanProposalSchema,
  imageObservationSchema,
  observeImageRequestSchema,
  planDayRequestSchema,
  whatNowRequestSchema,
  whatNowSchema,
} from '../todo/planner-schema';

function nonnegativeEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function budgetUsd() {
  return {
    dailyBudgetUsd: nonnegativeEnvNumber('AI_DAILY_BUDGET_USD_PER_USER', 0.05),
    estimatedRequestCostUsd: nonnegativeEnvNumber('AI_ESTIMATED_REQUEST_USD', 0.01),
  };
}

async function withTelemetry<T>(params: {
  client: DbClient;
  userId: string;
  logicalDate: string;
  trigger: string;
  model: string;
  run: () => Promise<T>;
}): Promise<{ status: number; body: object }> {
  const started = Date.now();
  try {
    const value = await params.run();
    return { status: 200, body: value as object };
  } catch (error) {
    if (error instanceof AiBudgetError) {
      return {
        status: 429,
        body: { error: "Today's AI limit is resting. Plan the day by hand for now." },
      };
    }
    if (error instanceof AiConfigError) {
      return { status: 503, body: { error: 'Mus planning is not configured.' } };
    }
    await insertAgentRunTelemetry(params.client, {
      id: crypto.randomUUID(),
      userId: params.userId,
      requestId: crypto.randomUUID(),
      logicalDate: params.logicalDate,
      trigger: params.trigger,
      model: params.model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - started,
      outcome: 'fallback',
      errorCode: `${params.trigger}_failed`,
      updatedAt: new Date().toISOString(),
      agent: params.trigger,
    }).catch(() => undefined);
    return { status: 502, body: { error: 'Mus could not finish that plan.' } };
  }
}

function gate(client: DbClient, userId: string, logicalDate: string, trigger: string, model: string) {
  const { dailyBudgetUsd, estimatedRequestCostUsd } = budgetUsd();
  return {
    dailyBudgetUsd,
    estimatedRequestCostUsd,
    spentUsd: () => getAgentSpendUsd(client, { userId, logicalDate }),
    recordUsage: async (usage: { costUsd: number; latencyMs: number }) => {
      await insertAgentRunTelemetry(client, {
        id: crypto.randomUUID(),
        userId,
        requestId: crypto.randomUUID(),
        logicalDate,
        trigger,
        model,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: usage.costUsd,
        latencyMs: usage.latencyMs,
        outcome: 'model',
        errorCode: '',
        updatedAt: new Date().toISOString(),
        agent: trigger,
      });
    },
  };
}

const PLAN_DAY_SYSTEM = `You propose a day plan for KayaMo. Output only the schema.

Hard rules:
- This is a proposal. The user confirms before anything is written.
- Never invent nutrition numbers or change calorie targets.
- Never move FIXED or locked blocks. Keep them where they are.
- ANYTIME items stay off the clock; list them in deferrals or questions.
- Place EVENT / FIXED blocks first, then FLEXIBLE work, then optional filler.
- Leave white space. Do not pack every open minute.
- For mode=restructure, plan only from nowMin onward. Do not rewrite the past.
- For mode=rescue or minimum, keep only the non-negotiables and one meaningful next action.
- If tasks do not fit, set overload true and defer lower-priority work with a reason.
- If a gym session's typicalDurationMin is longer than a candidate slot, warn in summary and do not squeeze it.
- If weatherNote is present, treat it as the user's stated weather only. Never invent weather. Never fetch weather.
- If location is away from home, you may propose TRAVEL_BLOCK for transit when duration is implied. Do not invent trips.
- Do not diagnose mood. Do not use shame copy.
- Use the supplied task ids. Do not invent uuids.`;

const WHAT_NOW_SYSTEM = `You rank 1 to 5 things the user can do in the current open window.

Only use supplied tasks. Prefer unblocked work that fits availableMinutes.
Match location and energy when those fields are present. No nutrition numbers. No shame.`;

const CAPTURE_SYSTEM = `Parse a brain dump into capture items. Philippine English and Taglish are normal.

Kinds: TASK, EVENT, ROUTINE, HABIT, INBOX, PROJECT.
If timing is vague, use INBOX. If a time is named, use EVENT.
confidence is 0-1. Ask at most five clarifying questions. No nutrition numbers.`;

const OBSERVE_SYSTEM = `Observe the attached image for KayaMo.

If it is food, name dishes and household portions only. Never output calories, grams of macros, or sodium.
If it is a whiteboard, timetable, or list, extract capture items.
If unsure, kind=other and ask questions.
This is observation only. The user confirms every write.`;

export async function handlePlanDay(
  client: DbClient,
  userId: string,
  body: unknown,
): Promise<{ status: number; body: object }> {
  const parsed = planDayRequestSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'Invalid plan-day request.' } };
  const model = process.env.MUS_ORCHESTRATOR_MODEL?.trim() || process.env.MODEL_SMALL?.trim() || 'gpt-5.6-luna';
  return withTelemetry({
    client,
    userId,
    logicalDate: parsed.data.logicalDate,
    trigger: 'mus_plan_day',
    model,
    run: async () => {
      const plan = await completeObject(
        {
          tier: 'small',
          schema: dayPlanProposalSchema,
          system: PLAN_DAY_SYSTEM,
          userId,
          messages: [{ role: 'user', content: JSON.stringify(parsed.data) }],
        },
        { modelId: model, budget: gate(client, userId, parsed.data.logicalDate, 'mus_plan_day', model) },
      );
      return {
        plan:
          plan.logicalDate === parsed.data.logicalDate
            ? plan
            : { ...plan, logicalDate: parsed.data.logicalDate },
      };
    },
  });
}

export async function handleWhatNow(
  client: DbClient,
  userId: string,
  body: unknown,
): Promise<{ status: number; body: object }> {
  const parsed = whatNowRequestSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'Invalid what-now request.' } };
  const model = process.env.MUS_FAST_MODEL?.trim() || process.env.MODEL_NANO?.trim() || 'gpt-5.6-luna';
  return withTelemetry({
    client,
    userId,
    logicalDate: parsed.data.logicalDate,
    trigger: 'mus_what_now',
    model,
    run: async () => ({
      whatNow: await completeObject(
        {
          tier: 'nano',
          schema: whatNowSchema,
          system: WHAT_NOW_SYSTEM,
          userId,
          messages: [{ role: 'user', content: JSON.stringify(parsed.data) }],
        },
        { modelId: model, budget: gate(client, userId, parsed.data.logicalDate, 'mus_what_now', model) },
      ),
    }),
  });
}

export async function handleCaptureText(
  client: DbClient,
  userId: string,
  body: unknown,
): Promise<{ status: number; body: object }> {
  const parsed = captureTextRequestSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'Invalid capture request.' } };
  const model = process.env.MUS_FAST_MODEL?.trim() || process.env.MODEL_NANO?.trim() || 'gpt-5.6-luna';
  return withTelemetry({
    client,
    userId,
    logicalDate: parsed.data.logicalDate,
    trigger: 'mus_capture',
    model,
    run: async () => ({
      capture: await completeObject(
        {
          tier: 'nano',
          schema: captureProposalSchema,
          system: CAPTURE_SYSTEM,
          userId,
          messages: [{ role: 'user', content: parsed.data.text }],
        },
        { modelId: model, budget: gate(client, userId, parsed.data.logicalDate, 'mus_capture', model) },
      ),
    }),
  });
}

export async function handleObserveImage(
  client: DbClient,
  userId: string,
  body: unknown,
): Promise<{ status: number; body: object }> {
  const parsed = observeImageRequestSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'Invalid image request.' } };
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(parsed.data.imageBase64, 'base64'));
  } catch {
    return { status: 400, body: { error: 'Could not read that image.' } };
  }
  if (bytes.byteLength < 32 || bytes.byteLength > 2_500_000) {
    return { status: 400, body: { error: 'That image is too large or empty.' } };
  }
  const model = process.env.MUS_VISION_MODEL?.trim() || process.env.MODEL_VISION?.trim() || 'gpt-5.4-mini';
  const caption = parsed.data.caption?.trim() || 'Observe this image for planning or food names only.';
  return withTelemetry({
    client,
    userId,
    logicalDate: parsed.data.logicalDate,
    trigger: 'mus_observe',
    model,
    run: async () => ({
      observation: await completeObject(
        {
          tier: 'vision',
          schema: imageObservationSchema,
          system: OBSERVE_SYSTEM,
          userId,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `${caption}\nModule: ${parsed.data.module}` },
                {
                  type: 'image',
                  image: bytes,
                  mediaType: parsed.data.mediaType,
                  providerOptions: { openai: { imageDetail: 'low' } },
                },
              ],
            },
          ],
        },
        { modelId: model, budget: gate(client, userId, parsed.data.logicalDate, 'mus_observe', model) },
      ),
    }),
  });
}
