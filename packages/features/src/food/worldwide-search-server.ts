import { HourlyLimiter, normalizedFoodSchema, searchExternalFoods, type NormalizedFood } from '@kayamo/food';

const providerBudget = new HourlyLimiter({ max: 10, windowMs: 60_000 });
const requestBudget = new HourlyLimiter({ max: 30, windowMs: 60_000 });
const timedFetch = (url: string, init?: RequestInit) =>
  fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(8000) });

/** No food history, service-role client, database writes or LLM calls. */
export async function worldwideSearchResponse(
  request: Request,
  deps: {
    getUserId: () => Promise<string | null>;
    search?: (query: string) => Promise<NormalizedFood[]>;
  },
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const userId = await deps.getUserId();
    if (!userId || userId.startsWith('guest-')) return json({ error: 'Sign in to search worldwide foods.' }, 401);
    const body = await request.json().catch(() => null);
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    if (!query || query.length > 200) return json({ error: 'Enter a food name or barcode (up to 200 characters).' }, 400);
    try { requestBudget.acquire(); }
    catch { return json({ error: 'Search is busy. Wait a minute and try again.' }, 429); }
    const foods = await (deps.search ?? ((text: string) => searchExternalFoods(text, {
      off: { fetch: timedFetch, limiter: providerBudget },
      usda: { fetch: timedFetch },
    })))(query);
    const valid = foods.flatMap((food) => {
      const parsed = normalizedFoodSchema.safeParse(food);
      return parsed.success ? [parsed.data] : [];
    });
    return json({ foods: valid, notice: 'Coverage varies by source. If a provider is unavailable, results may be incomplete.' });
  } catch {
    // Never echo upstream errors: provider URLs can contain credentials.
    return json({ error: 'Worldwide search is unavailable. Try again shortly or use your saved foods.' }, 502);
  }
}
