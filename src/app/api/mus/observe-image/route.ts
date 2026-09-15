import { allowanceRejection, reserveWebAiRequest } from '@/lib/server-ai-allowance';
import { NextResponse } from 'next/server';
import { handleObserveImage } from '@kayamo/features/mus-plan-server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to send a photo to Lis.' }, { status: 401 });
  }
  const allowanceError = allowanceRejection(await reserveWebAiRequest(user.id));
  if (allowanceError) return allowanceError;

  const result = await handleObserveImage(supabase, user.id, await request.json().catch(() => null));
  return NextResponse.json(result.body, { status: result.status });
}
