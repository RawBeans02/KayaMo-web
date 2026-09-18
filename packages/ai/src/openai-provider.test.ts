import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { cocoModelOutputSchema } from './contracts';
import type { CocoProviderRequest } from './coco-router';
import { baselineContext, validOutput } from './evals/doubles';
import { cocoMessages, createOpenAICocoProvider, type CocoModelCall } from './openai-provider';

function request(overrides: Partial<CocoProviderRequest> = {}): CocoProviderRequest {
  return {
    requestId: 'req-1',
    userId: 'user-1',
    mode: 'chat',
    message: 'what should lunch be',
    history: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hello.' },
    ],
    context: baselineContext(),
    maxOutputTokens: 400,
    ...overrides,
  };
}

describe('OpenAI Coco provider', () => {
  it('sends prior turns as messages and the current turn as a JSON envelope', () => {
    const messages = cocoMessages(request());
    expect(messages.slice(0, 2)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hello.' },
    ]);
    const envelope = JSON.parse(String(messages[2]?.content)) as { mode: string; message: string };
    expect(messages[2]?.role).toBe('user');
    expect(envelope.mode).toBe('chat');
    expect(envelope.message).toBe('what should lunch be');
  });

  it('goes through the injected model call with the chat schema and the persona prompt', async () => {
    const generate = vi.fn<CocoModelCall>(async () => ({
      object: validOutput(),
      usage: { inputTokens: 10, outputTokens: 5 },
    }));
    const provider = createOpenAICocoProvider({
      generate,
      model: 'test-model',
      inputUsdPerMillion: 1_000_000,
      outputUsdPerMillion: 2_000_000,
      estimatedRequestCostUsd: 0.01,
    });
    const result = await provider.generate(request());

    expect(generate).toHaveBeenCalledTimes(1);
    const call = generate.mock.calls[0]?.[0];
    expect(call?.schema).toBe(cocoModelOutputSchema);
    expect(call?.modelId).toBe('test-model');
    expect(call?.maxOutputTokens).toBe(400);
    expect(call?.system).toContain('Lis');
    expect(call?.messages).toHaveLength(3);

    expect(result.model).toBe('test-model');
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
    // 10 tokens at $1/token + 5 tokens at $2/token, per the (deliberately huge) rates.
    expect(result.costUsd).toBe(20);
    expect(result.output).toEqual(validOutput());
  });

  it('never bills below the estimated request cost', async () => {
    const provider = createOpenAICocoProvider({
      generate: async () => ({ object: validOutput() }),
      estimatedRequestCostUsd: 0.03,
      inputUsdPerMillion: 0,
      outputUsdPerMillion: 0,
    });
    const result = await provider.generate(request());
    expect(result.costUsd).toBe(0.03);
    expect(result.inputTokens).toBe(0);
  });

  it('refuses to construct without a key when it would have to reach the SDK itself', () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(() => createOpenAICocoProvider()).toThrow(/OPENAI_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });
});
