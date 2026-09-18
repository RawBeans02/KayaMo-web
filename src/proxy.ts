import { createCookieSupabase, isSupabaseConfigured } from '@kayamo/db';
import { type NextRequest, NextResponse } from 'next/server';
import { GUEST_COOKIE, isValidGuestId } from './lib/guest';
import { isProtectedPath } from './lib/protected-routes';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const gated = isProtectedPath(pathname);
  const isLogin = pathname === '/login';
  // The demo carries no Supabase session, so it can read and write nothing on
  // the server. It only unlocks the routes so the shell can render locally.
  const guest = isValidGuestId(request.cookies.get(GUEST_COOKIE)?.value);

  if (!isSupabaseConfigured()) {
    if (gated && !guest) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('setup', '1');
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createCookieSupabase({
    getAll: () => request.cookies.getAll(),
    setAll: (toSet) => {
      for (const { name, value } of toSet) {
        request.cookies.set(name, value);
      }
      response = NextResponse.next({ request });
      for (const { name, value, options } of toSet) {
        response.cookies.set(name, value, options);
      }
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (gated && !user && !guest) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/today';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * Next parses this object at compile time and requires `matcher` to be a
 * literal array of static strings. A spread of PROTECTED_ROUTES reads the same
 * but fails that analysis and every request 500s. So the list is repeated here
 * verbatim, and src/lib/protected-routes.test.ts asserts it equals
 * [...PROTECTED_ROUTES, '/app/:path*', '/login'] so the two cannot drift.
 */
export const config = {
  matcher: [
    '/today',
    '/calories',
    '/gym',
    '/todos',
    '/foods',
    '/verify',
    '/goals',
    '/life',
    '/grove',
    '/mus',
    '/settings',
    '/app/:path*',
    '/login',
  ],
};
