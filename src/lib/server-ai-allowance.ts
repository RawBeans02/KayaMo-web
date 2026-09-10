import 'server-only';
import { createServiceSupabase } from '@kayamo/db/service';
import { NextResponse } from 'next/server';

/** A request allowance, not a promise of exact provider-dollar accounting. */
export async function reserveWebAiRequest(userId: string): Promise<NextResponse | null> {
  const configured = Number(process.env.WEB_AI_DAILY_REQUEST_LIMIT ?? '5');
  const limit = Number.isInteger(configured) && configured >= 1 && configured <= 100 ? configured : 5;
  try {
    const { data, error } = await createServiceSupabase().rpc('reserve_web_ai_request', {
      p_user_id: userId,
      p_daily_limit: limit,
    });
    if (error || typeof data !== 'boolean') throw new Error('Allowance unavailable');
    if (!data) return NextResponse.json(
      { error: 'Your daily AI request allowance is used. Try again after 00:00 UTC; manual tracking still works.' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
    return null;
  } catch {
    // Missing migration/service configuration must never permit unmetered calls.
    return NextResponse.json({ error: 'Online AI is temporarily unavailable. Manual tracking still works.' }, { status: 503 });
  }
}
