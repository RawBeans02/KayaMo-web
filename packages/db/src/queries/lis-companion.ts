import type { DbClient } from './client';
import type { LisCompanionProfile } from '../database';
import { DbQueryError, throwIfError } from './errors';

/**
 * The companion profile: how someone wants Lis to speak to them.
 *
 * Not permission-gated. It holds no life data by construction, and the act of
 * typing it is the consent — see the header of migration 0021.
 */
export async function getLisCompanionProfile(
  client: DbClient,
  userId: string,
): Promise<LisCompanionProfile | null> {
  const { data, error } = await client
    .from('lis_companion_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  return data ?? null;
}

export type LisCompanionProfilePatch = {
  display_name?: string | null;
  pronouns?: string | null;
  language_register?: string;
  encouragement?: number;
  accountability?: number;
  humor?: number;
  proactivity?: number;
  about_me?: string | null;
  avoid_topics?: string[];
};

export async function upsertLisCompanionProfile(
  client: DbClient,
  userId: string,
  patch: LisCompanionProfilePatch,
): Promise<LisCompanionProfile> {
  const { data, error } = await client
    .from('lis_companion_profile')
    .upsert(
      {
        user_id: userId,
        ...patch,
        // Client clock, last-write-wins. The server_updated_at trigger owns the
        // sync cursor and is never written from here.
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('upsertLisCompanionProfile returned no row');
  return data;
}
