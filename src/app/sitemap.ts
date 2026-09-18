import type { MetadataRoute } from 'next';
import { publicIndexingEnabled, SITE_URL } from '../lib/site-metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  // Explicit public allowlist: no diary, goals, conversations or demo routes.
  // Do not invent lastModified dates on every build.
  return publicIndexingEnabled() ? [{ url: `${SITE_URL}/` }] : [];
}
