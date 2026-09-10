import 'server-only';
import { cocoModelOutputSchema } from './contracts';
import type {
  CocoProvider,
  CocoProviderRequest,
  CocoProviderResult,
} from './coco-router';

export type OpenAICocoProviderOptions = {
  apiKey?: string;
  model?: string;
  inputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  estimatedRequestCostUsd?: number;
};

function envNumber(name: string): number {
  const value = Number(process.env[name] ?? '0');
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function createOpenAICocoProvider(
  options: OpenAICocoProviderOptions = {},
): CocoProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY?.trim();
  const model =
    options.model ??
    process.env.MUS_ORCHESTRATOR_MODEL?.trim() ??
    process.env.MODEL_SMALL?.trim() ??
    'gpt-5.6-luna';
  const inputUsdPerMillion =
    options.inputUsdPerMillion ?? envNumber('MODEL_INPUT_USD_PER_MILLION');
  const outputUsdPerMillion =
    options.outputUsdPerMillion ?? envNumber('MODEL_OUTPUT_USD_PER_MILLION');
  const estimatedRequestCostUsd =
    options.estimatedRequestCostUsd ?? (envNumber('AI_ESTIMATED_REQUEST_USD') || 0.01);

  if (!apiKey) {
    throw new Error('Missing server-only OPENAI_API_KEY');
  }

  return {
    async generate(request: CocoProviderRequest): Promise<CocoProviderResult> {
      const { generateObject } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');
      const openai = createOpenAI({ apiKey });
      const result = await generateObject({
        model: openai.responses(model),
        schema: cocoModelOutputSchema,
        system: `You are Mus, KayaMo's supportive AI companion.

Use only the supplied confirmed and authorized context. A domain set to false in context.permissions is unavailable; never infer its stored data from another field. Never invent completed activity, Physical Self data, Scripture, or user memories. Faith content is opt-in: use Scripture only when permissions.faith is true and only quote the exact supplied scripture.text with a scripture citation. Never present generated, paraphrased, or remembered text as a Bible quotation, and never claim theological authority. Nutrition calculation is outside your authority: you may explain only the exact code-derived nutritionGuidance values supplied in context and must cite their target or expenditure record. Propose at most three actions and set requiresConfirmation to true for every proposal. Do not claim an action was executed. Use a gentle tone for reflection, a firm but respectful tone during explicit focus or workout sessions, and a balanced tone otherwise. Never shame missed days.`,
        prompt: JSON.stringify({
          mode: request.mode,
          message: request.message,
          context: request.context,
        }),
        maxOutputTokens: request.maxOutputTokens,
        maxRetries: 0,
        abortSignal: request.abortSignal,
        providerOptions: { openai: { reasoningEffort: 'low' } },
      });
      const inputTokens = result.usage.inputTokens ?? 0;
      const outputTokens = result.usage.outputTokens ?? 0;
      const tokenCostUsd =
        (inputTokens * inputUsdPerMillion + outputTokens * outputUsdPerMillion) /
        1_000_000;
      const costUsd = Math.max(tokenCostUsd, estimatedRequestCostUsd);
      return {
        output: result.object,
        model,
        inputTokens,
        outputTokens,
        costUsd,
      };
    },
  };
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}
