/**
 * Turn a Clerk identity into a Supabase session.
 *
 * Supabase stays the data layer with its own uuid user ids, row security and
 * sync; Clerk owns sign-in. The bridge joins the two on the verified email:
 * the Supabase account is created on first arrival (email confirmed, the Clerk
 * user id kept in its metadata), then a one-time token is generated with the
 * service role and redeemed on a cookie-bound client. No email is sent at any
 * point. This is the same mechanism the development skip-login has always
 * used, promoted to the real path.
 *
 * Pure over an injected client so the branches are unit-tested without a
 * database.
 */

export type BridgeIdentity = {
  clerkUserId: string;
  email: string | null;
};

/** The slice of the service-role admin API the bridge needs. */
export type BridgeAdmin = {
  createUser(attrs: {
    email: string;
    email_confirm: boolean;
    user_metadata: Record<string, string>;
  }): Promise<{ error: { message: string; code?: string } | null }>;
  generateLink(attrs: { type: 'magiclink'; email: string }): Promise<{
    data: {
      properties: { hashed_token: string } | null;
      user: { id: string; user_metadata?: Record<string, unknown> | null } | null;
    };
    error: { message: string } | null;
  }>;
  updateUserById(
    id: string,
    attrs: { user_metadata: Record<string, string> },
  ): Promise<{ error: { message: string } | null }>;
};

export type BridgeResult =
  | { ok: true; tokenHash: string; supabaseUserId: string; created: boolean }
  | { ok: false; reason: 'no_email' | 'create_failed' | 'link_failed' };

export const CLERK_METADATA_KEY = 'clerk_user_id';

function alreadyExists(error: { message: string; code?: string }): boolean {
  return (
    error.code === 'email_exists' ||
    error.code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(error.message)
  );
}

export async function mintSupabaseSession(
  identity: BridgeIdentity,
  admin: BridgeAdmin,
): Promise<BridgeResult> {
  const email = identity.email?.trim().toLowerCase();
  if (!email) return { ok: false, reason: 'no_email' };

  let created = false;
  const creation = await admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { [CLERK_METADATA_KEY]: identity.clerkUserId },
  });
  if (creation.error) {
    if (!alreadyExists(creation.error)) return { ok: false, reason: 'create_failed' };
  } else {
    created = true;
  }

  const link = await admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data.properties?.hashed_token;
  const user = link.data.user;
  if (link.error || !tokenHash || !user) return { ok: false, reason: 'link_failed' };

  // An account that predates Clerk (or was created by the skip-login) learns
  // its Clerk id the first time it comes through; later migrations key on it.
  if (!created && user.user_metadata?.[CLERK_METADATA_KEY] !== identity.clerkUserId) {
    await admin.updateUserById(user.id, {
      user_metadata: { [CLERK_METADATA_KEY]: identity.clerkUserId },
    });
  }

  return { ok: true, tokenHash, supabaseUserId: user.id, created };
}

/** What the login page shows when the bridge could not finish. Never a row. */
export function bridgeFailureMessage(reason: Exclude<BridgeResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'no_email':
      return 'Your account needs an email address to open KayaMo. Add one in your account settings and sign in again.';
    case 'create_failed':
      return 'We could not open your workspace this time. Please try signing in again.';
    case 'link_failed':
      return 'We could not open your workspace this time. Please try signing in again.';
  }
}
