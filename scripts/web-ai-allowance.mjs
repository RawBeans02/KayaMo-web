// Additive migration only. --check performs all DDL/tests inside a rolled-back transaction.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadRootEnv } from '../packages/db/src/load-root-env.ts';
loadRootEnv();
const postgres = createRequire(new URL('../packages/db/package.json', import.meta.url))('postgres');
const url = process.env.DATABASE_URL;
if (!url || new URL(url).hostname !== 'db.vfprugxigejdsyvipipf.supabase.co') {
  throw new Error('Expected the configured KayaMo database. No migration applied.');
}
const apply = process.argv.includes('--apply');
const sql = postgres(url, { ssl: 'require', max: 1, connect_timeout: 10, onnotice: () => {} });
const rollbackCheck = new Error('rollback-check');
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(readFileSync(new URL('../supabase/migrations/0020_web_ai_allowance.sql', import.meta.url), 'utf8'));
    const [acl] = await tx`select
      has_function_privilege('authenticated','public.reserve_web_ai_request(uuid,integer)','execute') as signed_in,
      has_function_privilege('anon','public.reserve_web_ai_request(uuid,integer)','execute') as anonymous`;
    if (acl.signed_in || acl.anonymous) throw new Error('Allowance is not server-only');
    // Test a synthetic account only inside a savepoint; never retain a user or allowance.
    await tx.unsafe('savepoint verify_allowance');
    const id = crypto.randomUUID();
    await tx`insert into auth.users(id) values (${id}::uuid)`;
    await tx`select set_config('request.jwt.claim.role','service_role',true)`;
    const results = [];
    for (let index = 0; index < 3; index++) {
      const [row] = await tx`select public.reserve_web_ai_request(${id}::uuid, 2) as allowed`;
      results.push(row.allowed);
    }
    if (JSON.stringify(results) !== '[true,true,false]') throw new Error('Allowance boundary failed');
    await tx.unsafe('rollback to savepoint verify_allowance');
    if (!apply) throw rollbackCheck;
  });
  console.log('Applied 0020: server-only allowance verified; no synthetic account or test usage retained.');
} catch (error) {
  if (error === rollbackCheck) console.log('Migration validation passed; all database changes rolled back.');
  else { console.error('Migration failed; transaction rolled back.', error.code ?? error.name); process.exitCode = 1; }
} finally {
  await sql.end({ timeout: 2 });
}
