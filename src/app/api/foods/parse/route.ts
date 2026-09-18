import { parseFoodMessage } from '@kayamo/ai';
import { foodParseSchema } from '@kayamo/food';
import { z } from 'zod';
import { json, jsonError, requireUser } from '@/lib/api';

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
