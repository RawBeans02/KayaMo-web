import { NextResponse } from 'next/server';
import { createServerSupabase } from './supabase/server';

/**
 * The route kit. Every authenticated JSON response goes out with this header;
 * a private response that a shared cache could store is a leak waiting for the
 * wrong deployment. Nine routes used to rely on Next's dynamic default instead.
 */
export const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' } as const;

export function json(body: object, init: { status?: number } = {}): NextResponse {
  return NextResponse.json(body, { status: init.status ?? 200, headers: NO_STORE });
}

export function jsonError(status: number, error: string): NextResponse {
  return json({ error }, { status });
}

type ServerClient = Awaited<ReturnType<typeof createServerSupabase>>;
type ServerUser = NonNullable<Awaited<ReturnType<ServerClient['auth']['getUser']>>['data']['user']>;

export type RequireUserResult =
  | { ok: true; supabase: ServerClient; user: ServerUser }
  | { ok: false; response: NextResponse };

/**
 * Resolve the signed-in user or produce the 401. The same eight lines were
 * copied into nine route files; this is them once. `createClient` is a
 * parameter only so a unit test can run this without cookies().
 */
export async function requireUser(
  request: Request,
  signInMessage: string,
  createClient: (request: Request) => Promise<ServerClient> = createServerSupabase,
): Promise<RequireUserResult> {
  const supabase = await createClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: jsonError(401, signInMessage) };
  return { ok: true, supabase, user };
}

/** Postgres error code or error name only; never a message that could carry a row. */
export function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return error instanceof Error ? error.name : 'unknown';
}
