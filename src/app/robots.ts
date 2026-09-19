import type { MetadataRoute } from 'next';
import { publicIndexingEnabled, SITE_URL } from '../lib/site-metadata';

export default function robots(): MetadataRoute.Robots {
  if (!publicIndexingEnabled()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    // Allow crawlers to read private-page noindex metadata. Blocking those URLs
    // here would prevent that. API/callback URLs must never be crawl targets.
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/auth/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
