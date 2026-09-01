import { afterEach, describe, expect, it, vi } from 'vitest';
import { authRedirectTo } from './ports';

const WEB_PORTS = {
  afterAuthPath: '/today',
  isNativeApp: () => false,
  nativeCallbackUrl: 'kayamo://auth/callback',
} as const;

describe('authRedirectTo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the native callback when the shell is Capacitor', () => {
    expect(
      authRedirectTo({
        afterAuthPath: '/app',
        isNativeApp: () => true,
        nativeCallbackUrl: 'kayamo://auth/callback',
      }),
    ).toBe('kayamo://auth/callback');
  });

  it('uses NEXT_PUBLIC_SITE_URL when window is unavailable', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://kayamo.fit/');
    expect(authRedirectTo(WEB_PORTS)).toBe(
      'https://www.kayamo.fit/auth/callback?next=%2Ftoday',
    );
  });

  it('falls back to kayamo.fit in production when no origin env is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(authRedirectTo(WEB_PORTS)).toBe(
      'https://www.kayamo.fit/auth/callback?next=%2Ftoday',
    );
  });

  it('uses the current origin in the browser', () => {
    vi.stubGlobal('window', { location: { origin: 'https://www.kayamo.fit' } });
    expect(authRedirectTo(WEB_PORTS)).toBe(
      'https://www.kayamo.fit/auth/callback?next=%2Ftoday',
    );
  });
});
