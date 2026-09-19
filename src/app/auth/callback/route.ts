import { createCookieSupabase } from '@kayamo/db';
import { authCallbackNextPath, isAuthOtpType } from '@kayamo/features/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = url.searchParams.get('type');
  const next = authCallbackNextPath(url.searchParams.get('next'), '/today');
  let destination = new URL(next, url.origin);
  // authCallbackNextPath already rejects protocol-relative and backslash
  // paths. This is the second lock: whatever the guard let through, a
  // redirect after a successful sign-in never leaves this origin.
  if (destination.origin !== url.origin) destination = new URL('/today', url.origin);

  const cookieStore = await cookies();
  const response = NextResponse.redirect(destination);
  const supabase = createCookieSupabase({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) {
        cookieStore.set(name, value, options);
        response.cookies.set(name, value, options);
      }
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  if (tokenHash && otpType && isAuthOtpType(otpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) return response;
  }

  return NextResponse.redirect(new URL('/login?error=Could%20not%20complete%20sign-in', url.origin));
}
