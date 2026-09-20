import { describe, expect, it, vi } from 'vitest';
import {
  CLERK_METADATA_KEY,
  bridgeFailureMessage,
  mintSupabaseSession,
  type BridgeAdmin,
} from './clerk-bridge';

function admin(overrides: Partial<BridgeAdmin> = {}) {
  const calls = { updateUserById: vi.fn(async () => ({ error: null })) };
  const base: BridgeAdmin = {
    createUser: async () => ({ error: null }),
    generateLink: async () => ({
      data: { properties: { hashed_token: 'hash-1' }, user: { id: 'uuid-1', user_metadata: {} } },
      error: null,
    }),
    updateUserById: calls.updateUserById,
  };
  return { admin: { ...base, ...overrides }, calls };
}

const identity = { clerkUserId: 'user_abc', email: 'Ana@Example.PH' };

describe('mintSupabaseSession', () => {
  it('creates the account on first arrival and returns the one-time token', async () => {
    const createUser = vi.fn(async () => ({ error: null }));
    const { admin: a, calls } = admin({ createUser });
    const result = await mintSupabaseSession(identity, a);
    expect(result).toEqual({ ok: true, tokenHash: 'hash-1', supabaseUserId: 'uuid-1', created: true });
    expect(createUser).toHaveBeenCalledWith({
      email: 'ana@example.ph',
      email_confirm: true,
      user_metadata: { [CLERK_METADATA_KEY]: 'user_abc' },
    });
    expect(calls.updateUserById).not.toHaveBeenCalled();
  });

  it('reuses an existing account and records the Clerk id on it once', async () => {
    const { admin: a, calls } = admin({
      createUser: async () => ({ error: { message: 'A user with this email address has already been registered', code: 'email_exists' } }),
    });
    const result = await mintSupabaseSession(identity, a);
    expect(result.ok).toBe(true);
    expect(calls.updateUserById).toHaveBeenCalledWith('uuid-1', {
      user_metadata: { [CLERK_METADATA_KEY]: 'user_abc' },
    });
  });

  it('does not rewrite metadata that already carries the Clerk id', async () => {
    const { admin: a, calls } = admin({
      createUser: async () => ({ error: { message: 'already registered' } }),
      generateLink: async () => ({
        data: {
          properties: { hashed_token: 'hash-2' },
          user: { id: 'uuid-1', user_metadata: { [CLERK_METADATA_KEY]: 'user_abc' } },
        },
        error: null,
      }),
    });
    await mintSupabaseSession(identity, a);
    expect(calls.updateUserById).not.toHaveBeenCalled();
  });

  it('refuses an identity without an email', async () => {
    const { admin: a } = admin();
    expect(await mintSupabaseSession({ clerkUserId: 'user_x', email: null }, a)).toEqual({
      ok: false,
      reason: 'no_email',
    });
  });

  it('reports a creation failure that is not "already exists"', async () => {
    const { admin: a } = admin({
      createUser: async () => ({ error: { message: 'Database error saving new user' } }),
    });
    expect(await mintSupabaseSession(identity, a)).toEqual({ ok: false, reason: 'create_failed' });
  });

  it('reports a link failure', async () => {
    const { admin: a } = admin({
      generateLink: async () => ({ data: { properties: null, user: null }, error: { message: 'nope' } }),
    });
    expect(await mintSupabaseSession(identity, a)).toEqual({ ok: false, reason: 'link_failed' });
  });

  it('never puts provider wording in the message a person sees', () => {
    for (const reason of ['no_email', 'create_failed', 'link_failed'] as const) {
      expect(bridgeFailureMessage(reason)).not.toMatch(/supabase|clerk|token|database/i);
    }
  });
});
