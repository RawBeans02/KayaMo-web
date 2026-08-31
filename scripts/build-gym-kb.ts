import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hydrateGymKnowledgeBase, validateGymKnowledgeBase } from '../packages/features/src/gym/kb/assemble';
import { catalogFromCsvFiles } from '../packages/features/src/gym/kb/from-csv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvDir = join(root, 'data', 'gym', 'csv');
const compiledPath = join(root, 'packages', 'features', 'src', 'gym', 'kb', 'compiled.json');

function loadCsvPackage(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(csvDir)) {
    if (!name.endsWith('.csv')) continue;
    files[name] = readFileSync(join(csvDir, name), 'utf8');
  }
  return files;
}

function main(): void {
  const checkOnly = process.argv.includes('--check');
  const compiled = catalogFromCsvFiles(loadCsvPackage());
  const kb = hydrateGymKnowledgeBase(compiled);
  const errors = validateGymKnowledgeBase(kb);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }

  const next = `${JSON.stringify(compiled, null, 2)}\n`;
  if (checkOnly) {
    let actual = '';
    try {
      actual = readFileSync(compiledPath, 'utf8');
    } catch {
      console.error('missing packages/features/src/gym/kb/compiled.json');
      process.exitCode = 1;
      return;
    }
    if (actual !== next) {
      console.error('compiled.json is stale. Run pnpm gym:kb:build.');
      process.exitCode = 1;
      return;
    }
    console.info(`Gym KB ok: ${kb.exercises.length} exercises from data/gym/csv.`);
    return;
  }

  mkdirSync(dirname(compiledPath), { recursive: true });
  writeFileSync(compiledPath, next);
  console.info(`Wrote compiled.json (${kb.exercises.length} exercises).`);
}

main();
