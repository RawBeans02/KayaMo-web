import { createServerSupabase } from '@/lib/supabase/server';
import { GUEST_COOKIE, isValidGuestId } from '@/lib/guest';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * The id every shell screen renders against: a real Supabase user, or a
 * demo guest whose data never leaves the browser.
 *
 * Each page used to repeat `getUser()` + `redirect('/login')`, which meant the
 * demo was gated in seven separate places. Resolve it once here instead.
 */
export async function requireShellUserId(): Promise<string> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;

  const guestId = (await cookies()).get(GUEST_COOKIE)?.value;
  if (isValidGuestId(guestId)) return guestId;

  redirect('/');
}
