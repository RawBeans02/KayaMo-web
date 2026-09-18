/**
 * Every route that needs a signed-in user or a valid guest cookie. The proxy
 * derives both its gate and its matcher from this list, so a route cannot be
 * gated without being matched or matched without being gated. A test checks
 * that every page under src/app/(shell) is here.
 */
export const PROTECTED_ROUTES = [
  '/today',
  '/calories',
  '/gym',
  '/todos',
  '/foods',
  '/verify',
  '/goals',
  '/life',
  '/grove',
  '/mus',
  '/settings',
] as const;

export type ProtectedRoute = (typeof PROTECTED_ROUTES)[number];

const PROTECTED = new Set<string>(PROTECTED_ROUTES);

/** Legacy `/app/*` links from the old shell still resolve through the redirect map. */
export function isProtectedPath(pathname: string): boolean {
  if (pathname === '/app' || pathname.startsWith('/app/')) return true;
  return PROTECTED.has(pathname);
}
