'use client';

import type { ReactNode } from 'react';

/**
 * Every shell page wraps its content in this: the new page rises into place
 * (the `kgRouteEnter` rule in glass.css) while the shell around it stays put.
 *
 * This used React's <ViewTransition> for a cross-fade with an exit as well,
 * which ran in Chromium but left Linux WebKit in CI stuck on the shell's
 * loading state with "WebKit encountered an internal error" on every
 * resource (Next's own guide warns Safari behaves differently). A CSS
 * entrance animation is engine-proof and honours Reduce Motion through the
 * global rule; the exit is a cut, which is what every browser did before.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  return (
    <div className="kgRouteEnter" data-route-enter="">
      {children}
    </div>
  );
}
