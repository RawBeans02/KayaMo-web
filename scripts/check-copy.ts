#!/usr/bin/env tsx
/**
 * ch33 banned-copy sweep. Scans prompt templates and UI copy.
 * Allowlist is path-based — not a magic comment.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBannedCopy } from '../packages/ai/src/banned-copy';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_ROOTS = [
  'src',
  'packages/ai/src',
  'packages/ui/src',
  'packages/core/src',
];

const EXCLUDE_BY_PATH = [
  /\/packages\/ai\/src\/safety\.ts$/,
  /\/packages\/ai\/src\/safety\.test\.ts$/,
  /\/packages\/ai\/src\/banned-copy(\.unit)?(\.test)?\.ts$/,
  /\/scripts\/check-copy\.ts$/,
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

function lineNumber(source: string, excerpt: string): number {
  const index = source.indexOf(excerpt);
  if (index < 0) return 1;
  return source.slice(0, index).split('\n').length;
}

async function main(): Promise<void> {
  const hits: string[] = [];
  for (const rel of SCAN_ROOTS) {
    const files = await walkTsFiles(path.join(repoRoot, rel));
    for (const file of files) {
      const posix = file.split(path.sep).join('/');
      if (EXCLUDE_BY_PATH.some((pattern) => pattern.test(posix))) continue;
      const source = await readFile(file, 'utf8');
      for (const hit of findBannedCopy(source)) {
        const relFile = path.relative(repoRoot, file);
        hits.push(`${relFile}:${lineNumber(source, hit.excerpt)}: ${hit.id} — ${hit.excerpt}`);
      }
    }
  }

  if (hits.length > 0) {
    console.error('Banned copy found:');
    for (const hit of hits) console.error(`  ${hit}`);
    process.exit(1);
  }

  console.log('Banned-copy sweep clean.');
}

void main();
