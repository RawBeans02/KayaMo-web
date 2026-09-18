import { afterEach, describe, expect, it } from 'vitest';
import { nonnegativeEnvNumber, readAiBudgetEnv } from './ai-budget-env';

const saved = { ...process.env };
afterEach(() => {
  delete process.env.AI_DAILY_BUDGET_USD_PER_USER;
  delete process.env.AI_ESTIMATED_REQUEST_USD;
  delete process.env.TEST_KNOB;
  Object.assign(process.env, saved);
});

describe('AI budget env', () => {
  it('falls back when unset, blank, negative or not a number', () => {
    delete process.env.TEST_KNOB;
    expect(nonnegativeEnvNumber('TEST_KNOB', 0.05)).toBe(0.05);
    process.env.TEST_KNOB = '';
    expect(nonnegativeEnvNumber('TEST_KNOB', 0.05)).toBe(0.05);
    process.env.TEST_KNOB = '-1';
    expect(nonnegativeEnvNumber('TEST_KNOB', 0.05)).toBe(0.05);
    process.env.TEST_KNOB = 'lots';
    expect(nonnegativeEnvNumber('TEST_KNOB', 0.05)).toBe(0.05);
  });

  it('reads both knobs with the shared defaults', () => {
    delete process.env.AI_DAILY_BUDGET_USD_PER_USER;
    delete process.env.AI_ESTIMATED_REQUEST_USD;
    expect(readAiBudgetEnv()).toEqual({ dailyBudgetUsd: 0.05, estimatedRequestCostUsd: 0.01 });
    process.env.AI_DAILY_BUDGET_USD_PER_USER = '0.2';
    process.env.AI_ESTIMATED_REQUEST_USD = '0';
    expect(readAiBudgetEnv()).toEqual({ dailyBudgetUsd: 0.2, estimatedRequestCostUsd: 0 });
  });
});
