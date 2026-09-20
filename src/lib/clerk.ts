/**
 * Clerk is the front door (owner decision 2026-09-20): accounts, passwords,
 * sign-in UI and password reset live there. Supabase keeps its own session
 * for data access, minted server-side after a Clerk sign-in (see
 * clerk-bridge.ts), so row security, sync and every test stay unchanged.
 *
 * The publishable key is the switch. Without it the app still builds and the
 * demo still runs (CI's `check` job has no Clerk keys), and the login page
 * says what is missing instead of throwing from ClerkProvider.
 */
export function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

/** Where a Clerk sign-in lands: the route that mints the Supabase session. */
export const CLERK_BRIDGE_PATH = '/auth/bridge';
