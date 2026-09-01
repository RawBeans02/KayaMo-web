import { authCallbackNextPath } from '@kayamo/features/auth';
import { describe, expect, it } from 'vitest';
import { authCallbackPathFromSearch } from './auth-landing';

describe('desktop auth landing', () => {
  it('defaults next to today', () => {
    expect(authCallbackNextPath(null, '/today')).toBe('/today');
  });

  it('forwards a PKCE code from the site-url landing', () => {
    expect(authCallbackPathFromSearch({ code: 'f77d0b16-69fa-4496-a844-22209f6d947f' }, '/today')).toBe(
      '/auth/callback?code=f77d0b16-69fa-4496-a844-22209f6d947f&next=%2Ftoday',
    );
  });

  it('forwards token_hash magic links and keeps a safe next path', () => {
    expect(
      authCallbackPathFromSearch(
        { token_hash: 'abc', type: 'magiclink', next: 'https://evil.example' },
        '/today',
      ),
    ).toBe('/auth/callback?token_hash=abc&type=magiclink&next=%2Ftoday');
  });

  it('ignores ordinary visits', () => {
    expect(authCallbackPathFromSearch({}, '/today')).toBeNull();
  });
});
