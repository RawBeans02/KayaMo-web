import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { githubSupabaseEnvironment } from './github-supabase-env.mjs';
const input = [
  'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY="test-anon"',
  "SUPABASE_SERVICE_ROLE_KEY='test-service'",
  'SUPABASE_DB_URL="postgresql://postgres:local-password@127.0.0.1:54322/postgres"',
].join('\n');
test('removes shell quotes without evaluating values or exporting unrelated keys', () => {
  const parsed = githubSupabaseEnvironment(input + '\nUNRELATED="ignore"');
  assert.ok(parsed.includes('NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n'));
  assert.ok(parsed.includes('SUPABASE_SERVICE_ROLE_KEY=test-service\n'));
  assert.ok(parsed.endsWith('RUN_DB_TESTS=1\n'));
  assert.ok(!parsed.includes('UNRELATED'));
});
test('refuses incomplete configuration', () => assert.throws(() => githubSupabaseEnvironment('')));
test('refuses a hosted database', () => assert.throws(() => githubSupabaseEnvironment(input.replaceAll('127.0.0.1', 'example.com'))));
test('refuses multiline values', () => assert.throws(() => githubSupabaseEnvironment(input.replace('test-anon', 'a\\nb'))));
