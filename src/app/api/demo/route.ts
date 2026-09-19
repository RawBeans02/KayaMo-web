import { type NextRequest, NextResponse } from 'next/server';
import {
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  guestCookieSecure,
  isValidGuestId,
  newGuestId,
} from '@/lib/guest';

/**
 * Starts or ends the no-account demo.
 *
 * POST issues a guest id cookie; DELETE clears it. Neither touches Supabase —
 * a guest has no session and therefore no server read or write path at all.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const previousId = request.cookies.get(GUEST_COOKIE)?.value;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    GUEST_COOKIE,
    isValidGuestId(previousId) ? previousId : newGuestId(),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: guestCookieSecure(request),
      path: '/',
      maxAge: GUEST_COOKIE_MAX_AGE,
    },
  );
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GUEST_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
