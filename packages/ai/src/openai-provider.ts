import 'server-only';
import type { z } from 'zod';
import { renderLisSystemPrompt } from './persona';
import { cocoModelOutputSchema } from './contracts';
import {
  assertNoInventedNutrition,
  callOpenAIObject,
  type AiMessage,
  type ModelUsage,
} from './router';
import type {
  CocoProvider,
  CocoProviderRequest,
  CocoProviderResult,
} from './coco-router';

/** What the provider needs from the model layer; injectable so it can be tested. */
export type CocoModelCall = (call: {
  modelId: string;
  schema: typeof cocoModelOutputSchema;
  system: string;
  messages: AiMessage[];
  abortSignal?: AbortSignal;
  maxOutputTokens: number;
}) => Promise<{ object: unknown; usage?: ModelUsage }>;

export type OpenAICocoProviderOptions = {
  apiKey?: string;
  model?: string;
  inputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  estimatedRequestCostUsd?: number;
  /** Test seam. Production leaves this unset and goes through the router. */
  generate?: CocoModelCall;
};

function envNumber(name: string): number {
  const value = Number(process.env[name] ?? '0');
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Prior turns go in as real messages; the current turn is a JSON envelope. */
export function cocoMessages(request: CocoProviderRequest): AiMessage[] {
  return [
    ...request.history.map((turn) => ({ role: turn.role, content: turn.content })),
    {
      role: 'user' as const,
      content: JSON.stringify({
        mode: request.mode,
        message: request.message,
        context: request.context,
      }),
    },
  ];
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

  if (!apiKey && !options.generate) {
    throw new Error('Missing server-only OPENAI_API_KEY');
  }

  // The chat schema carries no nutrition fields. This is the same check every
  // completeObject call gets; a chat provider is not exempt from the rule.
  assertNoInventedNutrition(cocoModelOutputSchema as z.ZodType, false);

  const generate: CocoModelCall =
    options.generate ??
    ((call) =>
      callOpenAIObject({
        apiKey: apiKey ?? '',
        modelId: call.modelId,
        schema: call.schema,
        system: call.system,
        messages: call.messages,
        abortSignal: call.abortSignal,
        maxOutputTokens: call.maxOutputTokens,
        reasoningEffort: 'low',
      }));

  return {
    async generate(request: CocoProviderRequest): Promise<CocoProviderResult> {
      const result = await generate({
        modelId: model,
        schema: cocoModelOutputSchema,
        system: renderLisSystemPrompt(request.context),
        messages: cocoMessages(request),
        maxOutputTokens: request.maxOutputTokens,
        abortSignal: request.abortSignal,
      });
      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;
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
