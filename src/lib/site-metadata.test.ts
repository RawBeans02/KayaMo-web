import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PRIVATE_ROBOTS,
  publicIndexingEnabled,
  SITE_URL,
  WEBSITE_SCHEMA,
} from './site-metadata';
import robots from '../app/robots';
import sitemap from '../app/sitemap';

afterEach(() => vi.unstubAllEnvs());

describe('public search metadata', () => {
  it('keeps development and Vercel previews out of search', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(publicIndexingEnabled()).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(publicIndexingEnabled()).toBe(false);
    expect(sitemap()).toEqual([]);
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('includes only the real public home in production sitemap', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(sitemap()).toEqual([{ url: `${SITE_URL}/` }]);
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/auth/'] },
      sitemap: `${SITE_URL}/sitemap.xml`,
    });
  });

  it('supports a standalone production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', '');
    expect(publicIndexingEnabled()).toBe(true);
  });

  it('defaults private pages to noindex without inheriting a home canonical', () => {
    expect(PRIVATE_ROBOTS).toEqual({ index: false, follow: false });
    const root = readFileSync('src/app/layout.tsx', 'utf8');
    expect(root).toContain('robots: PRIVATE_ROBOTS');
    expect(root).not.toContain('canonical:');
  });

  it('uses factual website schema without invented prices, reviews or search actions', () => {
    expect(WEBSITE_SCHEMA['@type']).toBe('WebSite');
    expect(WEBSITE_SCHEMA.url).toBe(SITE_URL);
    expect(WEBSITE_SCHEMA).not.toHaveProperty('aggregateRating');
    expect(WEBSITE_SCHEMA).not.toHaveProperty('offers');
    expect(WEBSITE_SCHEMA).not.toHaveProperty('potentialAction');
  });
});
