import { reserveWebAiRequest } from '@/lib/server-ai-allowance';
import { NextResponse } from 'next/server';
import { handleCaptureText } from '@kayamo/features/mus-plan-server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to capture with Lis.' }, { status: 401 });
  }
  // The handler reserves the allowance itself, after the body has parsed, so
  // a malformed request does not spend a slot.
  const result = await handleCaptureText(supabase, user.id, await request.json().catch(() => null), {
    reserveAllowance: reserveWebAiRequest,
  });
  return NextResponse.json(result.body, { status: result.status });
}
