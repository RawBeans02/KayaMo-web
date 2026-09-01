import { authCallbackNextPath } from '@kayamo/features/auth';

export type LandingSearch = Record<string, string | string[] | undefined>;

function firstString(
  search: LandingSearch | URLSearchParams,
  key: string,
): string | null {
  if (search instanceof URLSearchParams) return search.get(key);
  const value = search[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Supabase Site URL is often the origin with no path, so magic links arrive as
 * `/?code=…` (or `/login?code=…`). Forward those params to the PKCE exchange.
 */
export function authCallbackPathFromSearch(
  search: LandingSearch | URLSearchParams,
  fallbackNext: string,
): string | null {
  const code = firstString(search, 'code');
  const tokenHash = firstString(search, 'token_hash');
  if (!code && !tokenHash) return null;

  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (tokenHash) params.set('token_hash', tokenHash);
  const otpType = firstString(search, 'type');
  if (otpType) params.set('type', otpType);
  params.set('next', authCallbackNextPath(firstString(search, 'next'), fallbackNext));
  return `/auth/callback?${params.toString()}`;
}
