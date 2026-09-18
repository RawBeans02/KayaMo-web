export const AUTH_OTP_TYPES = [
  'magiclink',
  'email',
  'signup',
  'invite',
  'recovery',
  'email_change',
] as const;

export type AuthOtpType = (typeof AUTH_OTP_TYPES)[number];

export function isAuthOtpType(value: string): value is AuthOtpType {
  return (AUTH_OTP_TYPES as readonly string[]).includes(value);
}

/**
 * Same-origin path or the fallback. Callers resolve the result against the
 * request origin and redirect to it after a successful sign-in, so anything
 * that could change the origin is rejected here rather than trusted downstream.
 *
 * - It must start with exactly one slash: `//host` is protocol-relative and
 *   `new URL('//evil.example', origin)` resolves off-site.
 * - No backslash anywhere: browsers normalise `\` to `/` while parsing, so
 *   `/\evil.example` becomes `//evil.example` before it is followed.
 * - No whitespace or control characters; they have no place in a path and are
 *   a common smuggling vector.
 *
 * A scheme can only appear before the first slash, so the leading-slash rule
 * already excludes `javascript:` and friends.
 */
export function authCallbackNextPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (!/^\/(?![/\\])/.test(raw)) return fallback;
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (ch === '\\' || code <= 0x20 || code === 0x7f) return fallback;
  }
  return raw;
}
