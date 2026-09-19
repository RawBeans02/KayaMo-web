'use client';

import { ViewTransition, type ReactNode } from 'react';

/**
 * Every shell page wraps its content in this. Route navigations are React
 * transitions in the App Router, so the old page cross-fades and settles into
 * the new one instead of cutting (the `kg-route` rules in glass.css). The
 * wrapper lives in each page rather than the layout because layouts persist
 * across navigations and their enter/exit never fire. Browsers without the
 * View Transitions API, and people who asked for reduced motion, get a cut.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  return <ViewTransition default="kg-route">{children}</ViewTransition>;
}
