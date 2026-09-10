import { createServerSupabase } from '@/lib/supabase/server';
import { authCallbackPathFromSearch } from '@/lib/auth-landing';
import { GUEST_COOKIE, isValidGuestId } from '@/lib/guest';
import { Landing } from './landing/landing';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callback = authCallbackPathFromSearch(params, '/today');
  if (callback) redirect(callback);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/today');

  // Keep the public home reachable from sign-in without losing a guest's diary.
  const demoStarted = isValidGuestId((await cookies()).get(GUEST_COOKIE)?.value);
  return <Landing demoStarted={demoStarted} />;
}
