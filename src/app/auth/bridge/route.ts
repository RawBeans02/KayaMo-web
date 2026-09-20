import { auth, currentUser } from '@clerk/nextjs/server';
import { createCookieSupabase } from '@kayamo/db';
import { createServiceSupabase } from '@kayamo/db/service';
import { authCallbackNextPath } from '@kayamo/features/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { bridgeFailureMessage, mintSupabaseSession } from '@/lib/clerk-bridge';
import { isClerkConfigured } from '@/lib/clerk';

/**
 * Where Clerk sends a person after sign-in. Turns the Clerk session into the
 * Supabase session the rest of the app reads (see src/lib/clerk-bridge.ts),
 * then continues to `next`. Without a Clerk session it just goes to login.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = authCallbackNextPath(url.searchParams.get('next'), '/today');
  const toLogin = (message?: string) => {
    const target = new URL('/login', url.origin);
    if (message) target.searchParams.set('error', message);
    return NextResponse.redirect(target);
  };

  if (!isClerkConfigured()) return toLogin();
  const { userId } = await auth();
  if (!userId) return toLogin();

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;

  let minted: Awaited<ReturnType<typeof mintSupabaseSession>>;
  try {
    minted = await mintSupabaseSession(
      { clerkUserId: userId, email },
      createServiceSupabase().auth.admin,
    );
  } catch {
    minted = { ok: false, reason: 'link_failed' };
  }
  if (!minted.ok) return toLogin(bridgeFailureMessage(minted.reason));

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createCookieSupabase({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) {
        cookieStore.set(name, value, options);
        response.cookies.set(name, value, options);
      }
    },
  });
  const { error } = await supabase.auth.verifyOtp({
    token_hash: minted.tokenHash,
    type: 'magiclink',
  });
  if (error) return toLogin(bridgeFailureMessage('link_failed'));
  return response;
}
