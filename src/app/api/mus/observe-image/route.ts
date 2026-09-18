import { reserveWebAiRequest } from '@/lib/server-ai-allowance';
import { json, requireUser } from '@/lib/api';
import { handleObserveImage } from '@kayamo/features/mus-plan-server';

export async function POST(request: Request) {
  const auth = await requireUser(request, 'Sign in to send a photo to Lis.');
  if (!auth.ok) return auth.response;
  // The handler reserves the allowance itself, after the body has parsed, so
  // a malformed request does not spend a slot.
  const result = await handleObserveImage(auth.supabase, auth.user.id, await request.json().catch(() => null), {
    reserveAllowance: reserveWebAiRequest,
  });
  return json(result.body, { status: result.status });
}
