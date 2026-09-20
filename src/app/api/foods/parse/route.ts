import { parseFoodMessage } from '@kayamo/ai';
import { foodParseSchema } from '@kayamo/food';
import { z } from 'zod';
import { json, jsonError, requireUser } from '@/lib/api';
import { reserveWebAiRequest } from '@/lib/server-ai-allowance';

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  logicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.string(),
        mealSlot: z.string(),
        quantity: z.number(),
        unit: z.string().nullable().optional(),
      }),
    )
    .max(80)
    .default([]),
  aliases: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser(request, 'Sign in to parse food.');
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, 'Invalid parse request.');

  // The same per-user daily allowance every Lis route reserves, after the body
  // has parsed. Without a provider key the parser answers from its heuristic
  // and costs nothing, so no slot is spent. This was the one route that could
  // reach the model unmetered (found in the 2026-09-19 checklist audit).
  if (process.env.OPENAI_API_KEY?.trim()) {
    const allowance = await reserveWebAiRequest(user.id);
    if (!allowance.ok) return jsonError(allowance.status, allowance.error);
  }

  const result = await parseFoodMessage({
    userId: user.id,
    message: parsed.data.message,
    context: {
      logicalDate: parsed.data.logicalDate,
      entries: parsed.data.entries,
      aliases: parsed.data.aliases,
    },
  });
  return json(foodParseSchema.parse(result));
}
