import { getLisCompanionProfile, upsertLisCompanionProfile } from '@kayamo/db';
import { z } from 'zod';
import { errorCode, json, jsonError, requireUser } from '@/lib/api';

/**
 * The companion profile: how the user wants Lis to speak to them.
 *
 * Shaped after `/api/mus/permissions`, including its no-store headers, with one
 * deliberate difference: this is not permission-gated. It holds no life data by
 * construction and typing it IS the consent — gating it behind a domain that
 * defaults false would mean the persona silently never applies.
 */

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

export async function GET(request: Request) {
  const auth = await requireUser(request, 'Sign in to manage how Lis speaks to you.');
  if (!auth.ok) return auth.response;
  const { supabase: client, user } = auth;
  try {
    const row = await getLisCompanionProfile(client, user.id);
    // A user who has never opened the screen has no row, and that is not an
    // error: it is the cold start, and the caller renders defaults.
    return json({ profile: row });
  } catch (error) {
    console.error(`Lis companion profile read failed (${errorCode(error)}).`);
    return jsonError(500, 'Your companion settings are unavailable.');
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser(request, 'Sign in to manage how Lis speaks to you.');
  if (!auth.ok) return auth.response;
  const { supabase: client, user } = auth;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, 'Invalid companion settings.');
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
    return json({ profile: row });
  } catch (error) {
    console.error(`Lis companion profile write failed (${errorCode(error)}).`);
    return jsonError(500, 'Could not save your companion settings.');
  }
}
