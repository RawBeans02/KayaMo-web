/**
 * Drizzle + postgres.js. Node-only. Do not re-export from the public
 * `@kayamo/db` barrel — that package is imported by client components.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDrizzle(url: string) {
  const client = postgres(url, { max: 1, prepare: false });
  return { db: drizzle(client, { schema }), client };
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * The only callers of this are `seed.ts` and `ph-core.ts`, and both write:
 * seed deletes and re-inserts recipe rows, ph-core upserts catalog foods over
 * their name, kcal and macros. `.env.local` carries a DATABASE_URL pointing at
 * the hosted project, so running either by habit rewrites production data.
 *
 * Loopback needs no ceremony. Anything else has to be asked for out loud.
 */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL. Copy .env.example to .env.local.');
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  if (!LOOPBACK_HOSTS.has(host) && process.env.KAYAMO_ALLOW_REMOTE_DB !== '1') {
    throw new Error(
      `Refusing to open a writable connection to ${host}: it is not a local database. ` +
        'Point DATABASE_URL at a local Supabase, or set KAYAMO_ALLOW_REMOTE_DB=1 if you ' +
        'really mean to write to that host.',
    );
  }

  return url;
}
