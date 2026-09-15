import type { z } from 'zod';
import type { AiBudgetGate } from './budget';
import { nutritionKeysInZod } from './llm-nutrition-guard';
import { normalizeFoodPhrase, type PhraseCache } from './phrase-cache';

export type AiTier = 'nano' | 'small' | 'vision' | 'coach';

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

export class AiBudgetError extends Error {
  constructor(
    message = "Today's AI limit is resting. Search, barcode, and typing still work.",
  ) {
    super(message);
    this.name = 'AiBudgetError';
  }
}

export class AiTimeoutError extends Error {
  constructor(message = 'Kai took too long to reply. Try again.') {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

export type AiTextPart = { type: 'text'; text: string };
export type AiImagePart = {
  type: 'image';
  image: Uint8Array;
  mediaType: string;
  providerOptions?: { openai?: { imageDetail?: 'low' | 'high' | 'auto' } };
};
export type AiUserContent = AiTextPart | AiImagePart;

export type AiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | AiUserContent[];
};

export type GenerateObjectArgs<S extends z.ZodType> = {
  tier: AiTier;
  schema: S;
  system: string;
  messages: AiMessage[];
  userId: string;
  abortSignal?: AbortSignal;
};

export type GenerateObjectFn = <S extends z.ZodType>(
  args: GenerateObjectArgs<S>,
) => Promise<{ object: unknown }>;

export type CompleteObjectDeps = {
  generateObject?: GenerateObjectFn;
  budget?: AiBudgetGate;
  phraseCache?: { cache: PhraseCache; phrase: string };
  /**
   * Label OCR copies printed panel numbers and must opt in.
   * Food-log / meal-photo extract schemas must leave this unset.
   */
  allowNutritionKeys?: boolean;
  /** Override the env model for this call (still billed through the budget gate). */
  modelId?: string;
  /** Abort the provider call after this many ms. Default 15s, 30s for vision. */
  timeoutMs?: number;
};

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function envModel(tier: AiTier): string | undefined {
  if (tier === 'nano') return firstEnv('MUS_FAST_MODEL', 'MODEL_NANO');
  if (tier === 'small') return firstEnv('MUS_ORCHESTRATOR_MODEL', 'MODEL_SMALL');
  if (tier === 'vision') return firstEnv('MUS_VISION_MODEL', 'MODEL_VISION');
  return firstEnv('MODEL_COACH');
}

async function liveGenerateObject<S extends z.ZodType>(
  args: GenerateObjectArgs<S>,
  modelIdOverride?: string,
): Promise<{ object: unknown }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const modelId =
    modelIdOverride?.trim() || envModel(args.tier) || envModel('small');
  if (!apiKey || !modelId) {
    throw new AiConfigError('OCR is not configured. Fill the label by hand.');
  }

  const { generateObject } = await import('ai');
  const { createOpenAI } = await import('@ai-sdk/openai');
  const openai = createOpenAI({ apiKey });
  const generate = generateObject as unknown as (args: {
    model: unknown;
    schema: S;
    system: string;
    messages: AiMessage[];
    abortSignal?: AbortSignal;
    maxRetries: number;
    maxOutputTokens: number;
    providerOptions?: { openai?: { reasoningEffort?: 'none' | 'low' | 'medium' } };
  }) => Promise<{ object: unknown }>;
  return generate({
    model: openai.responses(modelId),
    schema: args.schema,
    system: args.system,
    messages: args.messages,
    abortSignal: args.abortSignal,
    maxRetries: 0,
    maxOutputTokens: 1500,
    ...(args.tier === 'vision' || Boolean(modelIdOverride)
      ? { providerOptions: { openai: { reasoningEffort: 'low' } } }
      : {}),
  });
}

function assertNoInventedNutrition<S extends z.ZodType>(
  schema: S,
  allowNutritionKeys: boolean | undefined,
): void {
  if (allowNutritionKeys) return;
  const keys = nutritionKeysInZod(schema);
  if (keys.length === 0) return;
  throw new AiConfigError(
    `LLM schema must not include nutrition fields (${keys.join(', ')}). Nutrition comes from the resolver.`,
  );
}

/**
 * Every LLM call goes through here. Do not log prompt/image/nutrition content.
 * Live calls (no generateObject test double) require a daily budget gate.
 */
export async function completeObject<S extends z.ZodType>(
  args: GenerateObjectArgs<S>,
  deps: CompleteObjectDeps = {},
): Promise<z.infer<S>> {
  assertNoInventedNutrition(args.schema, deps.allowNutritionKeys);

  if (deps.phraseCache) {
    const hit = await deps.phraseCache.cache.lookup(
      args.userId,
      normalizeFoodPhrase(deps.phraseCache.phrase),
    );
    if (hit !== null && hit !== undefined) {
      return args.schema.parse(hit);
    }
  }

  if (!deps.generateObject && !deps.budget) {
    throw new AiConfigError('Live LLM calls require a daily budget gate.');
  }

  if (deps.budget) {
    const spent = await deps.budget.spentUsd();
    if (spent + deps.budget.estimatedRequestCostUsd > deps.budget.dailyBudgetUsd) {
      throw new AiBudgetError();
    }
  }

  const generate =
    deps.generateObject ?? ((inner) => liveGenerateObject(inner, deps.modelId));
  const timeoutMs = deps.timeoutMs ?? (args.tier === 'vision' ? 30_000 : 15_000);
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(args.abortSignal?.reason);
  if (args.abortSignal) {
    if (args.abortSignal.aborted) controller.abort(args.abortSignal.reason);
    else args.abortSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const result = await withTimeout(
      generate({ ...args, abortSignal: controller.signal }),
      timeoutMs,
    );
    const parsed = args.schema.parse(result.object);
    const latencyMs = Date.now() - started;

    if (deps.budget) {
      await deps.budget.recordUsage({
        costUsd: deps.budget.estimatedRequestCostUsd,
        latencyMs,
      });
    }

    if (deps.phraseCache) {
      await deps.phraseCache.cache.store(
        args.userId,
        normalizeFoodPhrase(deps.phraseCache.phrase),
        parsed,
      );
    }

    return parsed;
  } catch (error) {
    if (controller.signal.aborted && !args.abortSignal?.aborted) {
      throw new AiTimeoutError();
    }
    if (error instanceof AiTimeoutError) throw error;
    throw error;
  } finally {
    clearTimeout(timer);
    args.abortSignal?.removeEventListener('abort', onParentAbort);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AiTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
