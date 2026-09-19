/**
 * The two per-user budget knobs, read once. This function used to exist three
 * times, in two route files and the planner handlers, with the same defaults.
 */
export function nonnegativeEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  // Blank means unset. The three copies this replaced let `Number('')`, which
  // is 0, through as a real value, so an empty AI_DAILY_BUDGET_USD_PER_USER in
  // a deployment would have silently zeroed the budget and blocked every call.
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function readAiBudgetEnv(): { dailyBudgetUsd: number; estimatedRequestCostUsd: number } {
  return {
    dailyBudgetUsd: nonnegativeEnvNumber('AI_DAILY_BUDGET_USD_PER_USER', 0.05),
    estimatedRequestCostUsd: nonnegativeEnvNumber('AI_ESTIMATED_REQUEST_USD', 0.01),
  };
}
