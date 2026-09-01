import { getOfflineScope } from '@kayamo/offline';

export async function waitForUserDb(userId: string, isCancelled: () => boolean): Promise<boolean> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline && !isCancelled()) {
    try {
      if (getOfflineScope().userId === userId) return true;
    } catch {
      /* Dexie has not opened the account database yet. */
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return false;
}
