import { parseFoodMessage } from '@kayamo/ai';
import { foodParseSchema } from '@kayamo/food';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';

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
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to parse food.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parse request.' }, { status: 400 });
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
  return NextResponse.json(foodParseSchema.parse(result));
}
