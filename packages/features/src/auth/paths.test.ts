import { describe, expect, it } from 'vitest';
import { authCallbackNextPath, isAuthOtpType } from './paths';

describe('authCallbackNextPath', () => {
  it('keeps an in-app path', () => {
    expect(authCallbackNextPath('/app/food', '/app')).toBe('/app/food');
  });

  it('keeps a path with a query and a fragment', () => {
    expect(authCallbackNextPath('/today?day=2026-09-18#plan', '/app')).toBe(
      '/today?day=2026-09-18#plan',
    );
  });

  it('falls back when next is missing', () => {
    expect(authCallbackNextPath(null, '/app')).toBe('/app');
    expect(authCallbackNextPath('', '/app')).toBe('/app');
  });

  it('rejects an external next value', () => {
    expect(authCallbackNextPath('https://evil.example', '/app')).toBe('/app');
  });

  // `new URL('//evil.example/x', origin)` resolves to https://evil.example/x.
  // A leading slash is not enough; the second character decides the origin.
  it('rejects a protocol-relative next value', () => {
    expect(authCallbackNextPath('//evil.example', '/app')).toBe('/app');
    expect(authCallbackNextPath('//evil.example/today', '/app')).toBe('/app');
  });

  // Browsers normalise a backslash to a slash while parsing, so `/\evil` is
  // `//evil` by the time it is followed.
  it('rejects a backslash anywhere in next', () => {
    expect(authCallbackNextPath('/\\evil.example', '/app')).toBe('/app');
    expect(authCallbackNextPath('/today\\evil', '/app')).toBe('/app');
  });

  it('rejects whitespace and control characters', () => {
    expect(authCallbackNextPath('/today evil', '/app')).toBe('/app');
    expect(authCallbackNextPath('/today\nevil', '/app')).toBe('/app');
    expect(authCallbackNextPath('/today\tevil', '/app')).toBe('/app');
  });

  it('rejects a scheme disguised as a path segment', () => {
    expect(authCallbackNextPath('javascript:alert(1)', '/app')).toBe('/app');
    expect(authCallbackNextPath('/javascript:alert(1)', '/app')).toBe('/javascript:alert(1)');
  });
});

describe('isAuthOtpType', () => {
  it('accepts magiclink', () => {
    expect(isAuthOtpType('magiclink')).toBe(true);
  });

  it('rejects an unknown type', () => {
    expect(isAuthOtpType('sms')).toBe(false);
  });
});
