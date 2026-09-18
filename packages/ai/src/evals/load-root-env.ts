import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load repo-root `.env.local` into process.env without overriding existing
 * values. Does not log keys or values.
 *
 * Deliberately duplicated from `packages/db/src/load-root-env.ts` rather than
 * imported: `@kayamo/ai` sits below `@kayamo/db` and must not depend on it, and
 * a test-only helper is not worth inverting that.
 *
 * It exists because `vitest` does not read `.env.local` — Next does that at
 * runtime. Without this, `pnpm --filter @kayamo/ai eval:record` skipped every
 * case with "OPENAI_API_KEY is not set" while the key sat in the file all along.
 */
export function loadRootEnv(): void {
  const candidates = [
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '../../.env.local'),
    resolve(process.cwd(), '../../../.env.local'),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    return;
  }
}
