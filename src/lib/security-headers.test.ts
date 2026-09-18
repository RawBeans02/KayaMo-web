import { describe, expect, it } from 'vitest';
import { securityHeaders } from './security-headers';

function header(list: ReturnType<typeof securityHeaders>, key: string): string | undefined {
  return list.find((entry) => entry.key === key)?.value;
}

describe('securityHeaders', () => {
  it('forbids framing in both the CSP and the legacy header', () => {
    const list = securityHeaders();
    expect(header(list, 'Content-Security-Policy')).toBe("frame-ancestors 'none'");
    expect(header(list, 'X-Frame-Options')).toBe('DENY');
  });

  it('ships nosniff, a strict referrer policy and a closed permissions policy', () => {
    const list = securityHeaders();
    expect(header(list, 'X-Content-Type-Options')).toBe('nosniff');
    expect(header(list, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header(list, 'Permissions-Policy')).toContain('camera=()');
    expect(header(list, 'Permissions-Policy')).toContain('geolocation=()');
  });

  // A script-src policy is intentionally absent until the inline boot scripts
  // carry nonces. If someone adds one here without that work, the site breaks
  // on first paint; this pins the decision so it is made on purpose.
  it('does not yet declare a script-src policy', () => {
    expect(header(securityHeaders(), 'Content-Security-Policy')).not.toContain('script-src');
  });

  it('adds HSTS only on the production deployment', () => {
    expect(header(securityHeaders(), 'Strict-Transport-Security')).toBeUndefined();
    expect(header(securityHeaders({ vercelEnv: 'preview' }), 'Strict-Transport-Security')).toBeUndefined();
    expect(header(securityHeaders({ vercelEnv: 'production' }), 'Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains',
    );
  });
});
