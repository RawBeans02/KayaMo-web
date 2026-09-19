import type { Metadata } from 'next';

export const SITE_URL = 'https://www.kayamo.fit';
export const SITE_TITLE = 'KayaMo — small steps, room to grow';
export const SITE_DESCRIPTION =
  'Plan your day, take meaningful steps toward your goals, and track food and workouts in one calm personal-growth app.';

// Private routes inherit this. Only the public landing page opts into indexing.
// These directives are not access control; authentication and RLS remain required.
export const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export function publicIndexingEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production')
  );
}

export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'KayaMo',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
};
