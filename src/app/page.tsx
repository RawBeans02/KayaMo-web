import { createServerSupabase } from '@/lib/supabase/server';
import { authCallbackPathFromSearch } from '@/lib/auth-landing';
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
  redirect(user ? '/today' : '/login');
}
