import 'server-only';
import { createServiceSupabase } from '@kayamo/db/service';
import { NextResponse } from 'next/server';
import type { AllowanceOutcome } from '@kayamo/features/mus-respond';

/**
 * A request allowance, not a promise of exact provider-dollar accounting.
 *
 * Returns a plain outcome rather than a NextResponse so the caller decides when
 * to spend it. It is deliberately reserved AFTER the request has been parsed and
 * after the crisis classifier has run: a malformed body should not cost a slot,
 * and a crisis reply — which never reaches a provider — must not be reachable
 * only while quota remains.
 */
export async function reserveWebAiRequest(userId: string): Promise<AllowanceOutcome> {
  const configured = Number(process.env.WEB_AI_DAILY_REQUEST_LIMIT ?? '5');
  const limit =
    Number.isInteger(configured) && configured >= 1 && configured <= 100 ? configured : 5;
  try {
    const { data, error } = await createServiceSupabase().rpc('reserve_web_ai_request', {
      p_user_id: userId,
      p_daily_limit: limit,
    });
    if (error || typeof data !== 'boolean') throw new Error('Allowance unavailable');
    if (!data) {
      return {
        ok: false,
        status: 429,
        error:
          'Your daily AI request allowance is used. It resets at 00:00 UTC; manual tracking still works.',
      };
    }
    return { ok: true };
  } catch {
    // Missing migration/service configuration must never permit unmetered calls.
    return {
      ok: false,
      status: 503,
      error: 'Online AI is temporarily unavailable. Manual tracking still works.',
    };
  }
}

/**
 * Adapter for routes that still reserve before parsing. Returns null when the
 * request may proceed, mirroring the previous signature.
 *
 * Those routes carry the same defect this module's doc comment describes — a
 * malformed body costs a daily slot — but they are not the chat path and were
 * left alone deliberately rather than widened into this change.
 */
export function allowanceRejection(outcome: AllowanceOutcome): NextResponse | null {
  if (outcome.ok) return null;
  return NextResponse.json(
    { error: outcome.error },
    { status: outcome.status, headers: { 'Cache-Control': 'no-store' } },
  );
}
