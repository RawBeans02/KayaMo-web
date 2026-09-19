import { describe, expect, it } from 'vitest';
import { guestCookieSecure } from './guest';

function request(url: string, proto?: string) {
  return { url, headers: { get: (name: string) => (name === 'x-forwarded-proto' ? (proto ?? null) : null) } };
}

describe('guestCookieSecure', () => {
  it('is Secure behind a TLS-terminating proxy', () => {
    expect(guestCookieSecure(request('http://internal/api/demo', 'https'))).toBe(true);
    expect(guestCookieSecure(request('http://internal/api/demo', 'https, http'))).toBe(true);
  });

  it('is Secure for a direct HTTPS request', () => {
    expect(guestCookieSecure(request('https://www.kayamo.fit/api/demo'))).toBe(true);
  });

  it('is not Secure on plain-HTTP localhost, so a production build can be tested there', () => {
    expect(guestCookieSecure(request('http://localhost:3002/api/demo'))).toBe(false);
    expect(guestCookieSecure(request('http://localhost:3002/api/demo', 'http'))).toBe(false);
  });

  it('fails closed on an unparsable URL', () => {
    expect(guestCookieSecure(request('not a url'))).toBe(true);
  });
});
