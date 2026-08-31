import { createCookieSupabase, isSupabaseConfigured } from '@kayamo/db';
import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED = new Set([
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
]);

function isProtected(pathname: string): boolean {
  if (pathname === '/app' || pathname.startsWith('/app/')) return true;
  return PROTECTED.has(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const gated = isProtected(pathname);
  const isLogin = pathname === '/login';

  if (!isSupabaseConfigured()) {
    if (gated) {
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

  if (gated && !user) {
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
    '/app/:path*',
    '/login',
  ],
};
