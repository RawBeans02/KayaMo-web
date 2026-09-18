/**
 * Response headers every route carries. Kept pure so a unit test can pin them
 * and next.config.ts stays a thin consumer.
 *
 * What is deliberately not here yet: a script-src Content-Security-Policy. The
 * root layout carries two inline boot scripts (theme and locale) and the
 * landing page inlines JSON-LD, so a real script policy needs per-request
 * nonces threaded through the layout. That is its own change, and it should
 * ship in Report-Only mode first. `frame-ancestors` is the one CSP directive
 * that has no script implications, so it ships now.
 */
export type HeaderEnv = {
  /** Vercel sets this to 'production' on the production deployment only. */
  vercelEnv?: string | undefined;
};

export type ResponseHeader = { key: string; value: string };

export function securityHeaders(env: HeaderEnv = {}): ResponseHeader[] {
  const headers: ResponseHeader[] = [
    // Clickjacking. Nothing on the site is meant to be embedded.
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    { key: 'X-Frame-Options', value: 'DENY' },
    // Never sniff a response into a different type than it declares.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Full URL to same-origin, origin only cross-origin, nothing on downgrade.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // The app uses none of these. Photo analysis is a file input, not the
    // camera API, so `camera=()` does not affect it.
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
  ];

  // HSTS only where HTTPS is certain. On localhost it would poison the browser's
  // view of the host for two years.
  if (env.vercelEnv === 'production') {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains',
    });
  }

  return headers;
}
