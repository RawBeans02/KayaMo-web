import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findBannedCopy } from './banned-copy';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const SCAN_ROOTS = [
  'src',
  'packages/ai/src',
  'packages/features/src',
  'packages/ui/src',
  'packages/core/src',
];

const ALLOWLIST = [
  /banned-copy\.(ts|test\.ts)$/,
  /safety\.ts$/,
];

async function walkTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkTsFiles(full)));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(full);
  }
  return files;
}

describe('banned copy', () => {
  it('does not appear in prompt templates or UI copy', async () => {
    const hits: string[] = [];
    for (const rel of SCAN_ROOTS) {
      const root = path.join(repoRoot, rel);
      const files = await walkTsFiles(root);
      for (const file of files) {
        if (ALLOWLIST.some((pattern) => pattern.test(file))) continue;
        const source = await readFile(file, 'utf8');
        for (const hit of findBannedCopy(source)) {
          hits.push(`${path.relative(repoRoot, file)}: ${hit.id} — ${hit.excerpt}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
