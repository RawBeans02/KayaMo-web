import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL'];

/** Supabase emits shell-quoted env values; GITHUB_ENV does not remove those quotes. */
export function githubSupabaseEnvironment(input) {
  const values = new Map();
  for (const line of input.split(/\r?\n/)) {
    const equal = line.indexOf('=');
    if (equal < 1) continue;
    const key = line.slice(0, equal).trim();
    if (!required.includes(key)) continue;
    let value = line.slice(equal + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (typeof value !== 'string' || !value || /[\r\n]/.test(value)) throw new Error('Invalid disposable credential format');
    values.set(key, value);
  }
  if (required.some((key) => !values.has(key))) throw new Error('Missing disposable database configuration');
  // This workflow must never target the hosted project.
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_DB_URL']) {
    let url;
    try { url = new URL(values.get(key)); } catch { throw new Error('Invalid disposable database URL'); }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('CI database must be local');
  }
  return required.map((key) => key + '=' + values.get(key)).join('\n') + '\nRUN_DB_TESTS=1\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required');
  appendFileSync(process.env.GITHUB_ENV, githubSupabaseEnvironment(readFileSync(0, 'utf8')));
}
