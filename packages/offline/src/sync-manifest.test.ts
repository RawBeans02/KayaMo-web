import { BIDIRECTIONAL_SYNC_CONTRACT } from '@kayamo/db';
import { describe, expect, it, vi } from 'vitest';
import { LOCAL_ONLY_TABLES } from './sync-registry';
import { SYNC_PUSH_TABLES, isSyncableTable } from './sync';

vi.mock('@kayamo/db', async (importOriginal) => {
  // The manifest only references the upsert functions; nothing here calls them.
  return await importOriginal();
});

describe('sync manifest', () => {
  const contract = [...BIDIRECTIONAL_SYNC_CONTRACT.map((spec) => spec.table)].sort();
  const handlers = [...SYNC_PUSH_TABLES].sort();

  // Before this, four hand-maintained lists and a 26-case switch had to agree
  // and nothing checked that they did. The manifest is typed against the
  // contract; this pins the runtime side too.
  it('has exactly one push handler per table in the sync contract', () => {
    expect(handlers).toEqual(contract);
  });

  it('isSyncableTable agrees with the manifest', () => {
    for (const table of handlers) expect(isSyncableTable(table)).toBe(true);
    for (const table of LOCAL_ONLY_TABLES) expect(isSyncableTable(table)).toBe(false);
    expect(isSyncableTable('sync_queue')).toBe(false);
    expect(isSyncableTable('__proto__')).toBe(false);
  });
});
