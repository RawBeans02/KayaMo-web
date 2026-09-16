import { getLisCompanionProfile, upsertLisCompanionProfile } from '@kayamo/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * The companion profile: how the user wants Lis to speak to them.
 *
 * Shaped after `/api/mus/permissions`, including its no-store headers, with one
 * deliberate difference: this is not permission-gated. It holds no life data by
 * construction and typing it IS the consent — gating it behind a domain that
 * defaults false would mean the persona silently never applies.
 */

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

/** Per-element length lives here, not in a CHECK; see migration 0021. */
const patchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(40).nullable().optional(),
    pronouns: z.string().trim().min(1).max(24).nullable().optional(),
    languageRegister: z.enum(['english', 'taglish', 'match_me']).optional(),
    encouragement: z.number().int().min(0).max(2).optional(),
    accountability: z.number().int().min(0).max(2).optional(),
    humor: z.number().int().min(0).max(2).optional(),
    proactivity: z.number().int().min(0).max(2).optional(),
    aboutMe: z.string().trim().min(1).max(600).nullable().optional(),
    avoidTopics: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  })
  .strict();

/** Postgres error code or error name only — never a message carrying row data. */
function describeCause(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return error instanceof Error ? error.name : 'unknown';
}

async function authenticated(request: Request) {
  const client = await createServerSupabase(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  return { client, user };
}

export async function GET(request: Request) {
  const { client, user } = await authenticated(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to manage how Lis speaks to you.' },
      { status: 401, headers: noStoreHeaders },
    );
  }
  try {
    const row = await getLisCompanionProfile(client, user.id);
    // A user who has never opened the screen has no row, and that is not an
    // error: it is the cold start, and the caller renders defaults.
    return NextResponse.json({ profile: row }, { headers: noStoreHeaders });
  } catch (error) {
    console.error(`Lis companion profile read failed (${describeCause(error)}).`);
    return NextResponse.json(
      { error: 'Your companion settings are unavailable.' },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function PUT(request: Request) {
  const { client, user } = await authenticated(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to manage how Lis speaks to you.' },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid companion settings.' },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const patch = parsed.data;
  try {
    const row = await upsertLisCompanionProfile(client, user.id, {
      ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
      ...(patch.pronouns !== undefined ? { pronouns: patch.pronouns } : {}),
      ...(patch.languageRegister !== undefined
        ? { language_register: patch.languageRegister }
        : {}),
      ...(patch.encouragement !== undefined
        ? { encouragement: patch.encouragement }
        : {}),
      ...(patch.accountability !== undefined
        ? { accountability: patch.accountability }
        : {}),
      ...(patch.humor !== undefined ? { humor: patch.humor } : {}),
      ...(patch.proactivity !== undefined ? { proactivity: patch.proactivity } : {}),
      ...(patch.aboutMe !== undefined ? { about_me: patch.aboutMe } : {}),
      ...(patch.avoidTopics !== undefined ? { avoid_topics: patch.avoidTopics } : {}),
    });
    return NextResponse.json({ profile: row }, { headers: noStoreHeaders });
  } catch (error) {
    console.error(`Lis companion profile write failed (${describeCause(error)}).`);
    return NextResponse.json(
      { error: 'Could not save your companion settings.' },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
