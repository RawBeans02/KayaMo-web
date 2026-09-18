import { worldwideSearchResponse } from '@kayamo/features/worldwide-search-server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  return worldwideSearchResponse(request, {
    getUserId: async () => {
      const client = await createServerSupabase(request);
      const { data: { user } } = await client.auth.getUser();
      return user?.id ?? null;
    },
  });
}
