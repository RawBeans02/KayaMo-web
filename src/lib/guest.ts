/**
 * No-account demo.
 *
 * A guest gets a random id in a cookie and nothing else. There is no Supabase
 * session, which is the safety property that matters: `startSync` bails whenever
 * `auth.getSession()` returns nothing, so a guest's food, workouts and todos
 * never leave the browser. The catalog they search is the static seed in
 * `public/demo-catalog.json`, not the `foods` table.
 *
 * The id is prefixed so guest rows are obvious in Dexie and can never collide
 * with a Supabase user id.
 */
export const GUEST_COOKIE = 'kayamo_guest';
export const GUEST_ID_PREFIX = 'guest-';

/** 30 days — long enough to come back to a demo, short enough to expire. */
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function isGuestId(userId: string | null | undefined): boolean {
  return typeof userId === 'string' && userId.startsWith(GUEST_ID_PREFIX);
}

/** Cookie values are attacker-controlled; only accept our own shape. */
export function isValidGuestId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^guest-[0-9a-f]{32}$/.test(value);
}

export function newGuestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${GUEST_ID_PREFIX}${hex}`;
}
