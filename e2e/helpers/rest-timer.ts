import { expect, type Page } from '@playwright/test';
import { waitForUserIndexedDb } from './idb';

/** Active workout + running rest so the shell clock can be asserted off Gym. */
export async function seedActiveRest(page: Page, seconds = 90): Promise<void> {
  const name = await waitForUserIndexedDb(page);
  const ok = await page.evaluate(
    async ({ dbName, secondsLeft }) => {
      const userId = decodeURIComponent(dbName.split(':user:')[1] ?? '');
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const now = Date.now();
      const started = new Date(now - 12 * 60_000).toISOString();
      const ends = new Date(now + secondsLeft * 1000).toISOString();
      const workoutId = 'e2e-rest-workout';

      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error ?? new Error('indexedDB.open failed'));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('workouts') || !db.objectStoreNames.contains('rest_timers')) {
            db.close();
            reject(new Error('workouts/rest_timers stores missing'));
            return;
          }
          const tx = db.transaction(['workouts', 'rest_timers'], 'readwrite');
          tx.objectStore('workouts').put({
            id: workoutId,
            user_id: userId,
            started_at: started,
            ended_at: null,
            logical_date: today,
            notes: null,
            routine_id: null,
            plan_id: null,
            plan_day_index: null,
            status: 'active',
            is_deload: false,
            created_at: started,
            updated_at: started,
            server_updated_at: started,
            deleted_at: null,
          });
          tx.objectStore('rest_timers').put({
            workout_id: workoutId,
            user_id: userId,
            started_at: started,
            ends_at: ends,
            performed_set_id: null,
            duration_seconds: secondsLeft,
            status: 'running',
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error ?? new Error('rest seed failed'));
        };
      });
      return true;
    },
    { dbName: name, secondsLeft: seconds },
  );
  expect(ok).toBe(true);
}
