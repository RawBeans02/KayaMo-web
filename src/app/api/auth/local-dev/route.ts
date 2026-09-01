import { LOCAL_DEV_EMAIL, isLocalDevLoginEnabled } from '@kayamo/features/auth';
import { createCookieSupabase } from '@kayamo/db';
import { createServiceSupabase } from '@kayamo/db/service';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));

  if (!isLocalDevLoginEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  let tokenHash: string | undefined;
  try {
    const service = createServiceSupabase();
    await service.auth.admin.createUser({
      email: LOCAL_DEV_EMAIL,
      email_confirm: true,
    });
    const generated = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: LOCAL_DEV_EMAIL,
    });
    const hash = generated.data.properties?.hashed_token;
    if (!generated.error && hash) tokenHash = hash;
  } catch {
    tokenHash = undefined;
  }

  if (!tokenHash) {
    return fail('Could not start a local session. Check SUPABASE_SERVICE_ROLE_KEY.');
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL('/today', url.origin));
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
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (error) return fail('Could not complete local sign-in.');
  return response;
}
