import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createMemoryAiBudgetGate } from './budget';
import { MemoryPhraseCache } from './phrase-cache';
import { AiBudgetError, AiConfigError, completeObject } from './router';

const nameSchema = z.object({ name: z.string() });

function args() {
  return {
    tier: 'small' as const,
    schema: nameSchema,
    system: 'test',
    userId: 'user-1',
    messages: [{ role: 'user' as const, content: '2 tasa kanin' }],
  };
}

describe('completeObject', () => {
  it('refuses a live call without a budget gate', async () => {
    await expect(completeObject(args())).rejects.toBeInstanceOf(AiConfigError);
  });

  it('skips the model when the daily budget is already spent', async () => {
    const generateObject = vi.fn(async () => ({ object: { name: 'kanin' } }));
    const budget = createMemoryAiBudgetGate({
      spentUsd: 0.05,
      dailyBudgetUsd: 0.05,
      estimatedRequestCostUsd: 0.01,
    });

    await expect(completeObject(args(), { generateObject, budget })).rejects.toBeInstanceOf(
      AiBudgetError,
    );
    expect(generateObject).not.toHaveBeenCalled();
    expect(budget.recorded).toEqual([]);
  });

  it('records estimated cost after a successful call', async () => {
    const budget = createMemoryAiBudgetGate({
      dailyBudgetUsd: 0.05,
      estimatedRequestCostUsd: 0.01,
    });

    await completeObject(args(), {
      budget,
      generateObject: async () => ({ object: { name: 'kanin' } }),
    });

    expect(budget.recorded).toHaveLength(1);
    expect(budget.recorded[0]?.costUsd).toBe(0.01);
    expect(await budget.spentUsd()).toBe(0.01);
  });

  it('returns a phrase-cache hit without calling the model or spending budget', async () => {
    const cache = new MemoryPhraseCache();
    await cache.store('user-1', '2 tasa kanin', { name: 'kanin' });
    const generateObject = vi.fn(async () => ({ object: { name: 'miss' } }));
    const budget = createMemoryAiBudgetGate({
      dailyBudgetUsd: 0.05,
      estimatedRequestCostUsd: 0.01,
    });

    const result = await completeObject(args(), {
      generateObject,
      budget,
      phraseCache: { cache, phrase: '  2 TASA kanin ' },
    });

    expect(result).toEqual({ name: 'kanin' });
    expect(generateObject).not.toHaveBeenCalled();
    expect(budget.recorded).toEqual([]);
  });

  it('stores a miss on the phrase cache after a successful extract', async () => {
    const cache = new MemoryPhraseCache();
    await completeObject(args(), {
      generateObject: async () => ({ object: { name: 'kanin' } }),
      phraseCache: { cache, phrase: '2 tasa kanin' },
    });

    expect(await cache.lookup('user-1', '2 tasa kanin')).toEqual({ name: 'kanin' });
  });

  it('rejects schemas that let the model emit nutrition numbers', async () => {
    await expect(
      completeObject(
        {
          ...args(),
          schema: z.object({ kcal: z.number() }),
        },
        { generateObject: async () => ({ object: { kcal: 400 } }) },
      ),
    ).rejects.toThrow(/nutrition fields \(kcal\)/);
  });

  it('still uses a generateObject double when a live model id is supplied', async () => {
    const generateObject = vi.fn(async () => ({ object: { name: 'kanin' } }));
    const budget = createMemoryAiBudgetGate({
      dailyBudgetUsd: 0.05,
      estimatedRequestCostUsd: 0.01,
    });
    const result = await completeObject(args(), {
      generateObject,
      budget,
      modelId: 'gpt-5.6',
    });
    expect(result).toEqual({ name: 'kanin' });
    expect(generateObject).toHaveBeenCalledOnce();
  });
});
