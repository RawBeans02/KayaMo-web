import 'server-only';
import { renderKaiSystemPrompt } from './persona';
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
        system: renderKaiSystemPrompt(request.context),
        // Prior turns go in as real messages, not folded into the JSON
        // envelope: the model treats a `user`/`assistant` exchange as dialogue
        // and a JSON array as data, and we want the former.
        messages: [
          ...request.history.map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
          {
            role: 'user' as const,
            content: JSON.stringify({
              mode: request.mode,
              message: request.message,
              context: request.context,
            }),
          },
        ],
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
