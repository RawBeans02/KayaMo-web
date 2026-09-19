import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { config as proxyConfig } from '../proxy';
import { PROTECTED_ROUTES, isProtectedPath } from './protected-routes';

const SHELL_DIR = join(process.cwd(), 'src/app/(shell)');

function shellRoutes(): string[] {
  return readdirSync(SHELL_DIR)
    .filter((name) => statSync(join(SHELL_DIR, name)).isDirectory())
    .map((name) => `/${name}`)
    .sort();
}

describe('protected routes', () => {
  // /settings was reachable without the proxy for a while: it existed under
  // (shell) but appeared in neither the gate nor the matcher. This pins the
  // filesystem to the list so that cannot recur silently.
  it('covers every page under src/app/(shell)', () => {
    const missing = shellRoutes().filter((route) => !PROTECTED_ROUTES.includes(route as never));
    expect(missing).toEqual([]);
  });

  it('lists only routes that exist', () => {
    const existing = new Set(shellRoutes());
    const stale = PROTECTED_ROUTES.filter((route) => !existing.has(route));
    expect(stale).toEqual([]);
  });

  // Next requires the proxy matcher to be a literal it can parse at compile
  // time, so it cannot be derived from PROTECTED_ROUTES in code. This is the
  // link instead: the literal must equal the list plus the two extras.
  it('is exactly what the proxy matcher matches', () => {
    expect(proxyConfig.matcher).toEqual([...PROTECTED_ROUTES, '/app/:path*', '/login']);
  });

  it('gates the legacy /app tree and nothing public', () => {
    expect(isProtectedPath('/app')).toBe(true);
    expect(isProtectedPath('/app/food')).toBe(true);
    expect(isProtectedPath('/settings')).toBe(true);
    expect(isProtectedPath('/')).toBe(false);
    expect(isProtectedPath('/login')).toBe(false);
    expect(isProtectedPath('/application')).toBe(false);
  });
});
