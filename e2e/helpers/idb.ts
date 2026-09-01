import { expect, type Page } from '@playwright/test';

/** Wait until Dexie has opened the signed-in account database. */
export async function waitForUserIndexedDb(page: Page): Promise<string> {
  let dbName = '';
  await expect
    .poll(
      async () => {
        dbName = await page.evaluate(async () => {
          const dbs = await indexedDB.databases();
          return dbs.find((db) => db.name?.includes(':user:'))?.name ?? '';
        });
        return dbName;
      },
      { timeout: 15_000 },
    )
    .not.toEqual('');
  return dbName;
}
