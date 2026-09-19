import { clerkMiddleware } from '@clerk/nextjs/server';
import { createCookieSupabase, isSupabaseConfigured } from '@kayamo/db';
import { type NextRequest, NextResponse } from 'next/server';
import { CLERK_BRIDGE_PATH, isClerkConfigured } from './lib/clerk';
import { GUEST_COOKIE, isValidGuestId } from './lib/guest';
import { isProtectedPath } from './lib/protected-routes';

/**
 * The gate. Two identities meet here: Clerk says who the person is, and the
 * Supabase session (a cookie minted by /auth/bridge after a Clerk sign-in)
 * is what the data layer reads. A Clerk session without a Supabase one is
 * sent through the bridge; no session at all goes to login; the demo guest
 * unlocks the routes with no session on either side.
 */
async function gate(request: NextRequest, clerkUserId: string | null) {
  const { pathname } = request.nextUrl;
  const gated = isProtectedPath(pathname);
  const isEntry = pathname === '/login' || pathname === '/sign-up';
  const guest = isValidGuestId(request.cookies.get(GUEST_COOKIE)?.value);
  // Only a page load is redirected. A POST here is a server action (Clerk's
  // own sign-out refresh, for one); bouncing it to a GET route answers 405
  // and the action fails. The action checks its own identity.
  const navigation = request.method === 'GET' || request.method === 'HEAD';

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

  if (navigation && !user && clerkUserId && (gated || isEntry) && pathname !== CLERK_BRIDGE_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = CLERK_BRIDGE_PATH;
    url.search = '';
    url.searchParams.set('next', gated ? pathname : '/today');
    return NextResponse.redirect(url);
  }

  if (navigation && gated && !user && !guest) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (navigation && isEntry && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/today';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * clerkMiddleware makes `auth()` available to the bridge route and the pages
 * under the matcher; the handler inside it is the gate above. Without a
 * publishable key (CI's build, a fresh clone) the gate runs on its own.
 */
export const proxy = isClerkConfigured()
  ? clerkMiddleware(async (auth, request) => gate(request, (await auth()).userId))
  : (request: NextRequest) => gate(request, null);

/**
 * Next parses this object at compile time and requires `matcher` to be a
 * literal array of static strings. A spread of PROTECTED_ROUTES reads the same
 * but fails that analysis and every request 500s. So the list is repeated here
 * verbatim, and src/lib/protected-routes.test.ts asserts it equals
 * [...PROTECTED_ROUTES, '/app/:path*', '/login', '/sign-up', '/auth/bridge',
 * '/__clerk/(.*)'] so the two cannot drift.
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
    '/sign-up',
    '/auth/bridge',
    '/__clerk/(.*)',
  ],
};
