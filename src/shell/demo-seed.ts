'use client';

import { installDemoCatalog } from '@kayamo/features';

// Cache the in-flight fetch, not a permanent "some rows exist" success marker.
// Reopening the demo repairs interrupted/partial catalog installations.
let download: Promise<unknown> | null = null;
export async function seedDemoCatalog(guestId: string): Promise<void> {
  download ??= fetch('/demo-catalog.json', { cache: 'force-cache' }).then(async (response) => {
    if (!response.ok) throw new Error('Demo catalog unavailable');
    return response.json();
  }).catch((error: unknown) => {
    download = null;
    throw error;
  });
  await installDemoCatalog(guestId, await download);
}
