#!/usr/bin/env tsx
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  catalogFromCsvFiles,
  validateCompiledTodoKb,
  validateCsvPackage,
} from '../packages/features/src/todo/kb/from-csv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvDir = join(root, 'data', 'todo', 'csv');
const compiledPath = join(root, 'packages', 'features', 'src', 'todo', 'kb', 'compiled.json');
const summaryPath = join(root, 'data', 'todo', 'BUILD_SUMMARY.json');

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
  const files = loadCsvPackage();
  const compiled = catalogFromCsvFiles(files);
  const errors = [...validateCsvPackage(files), ...validateCompiledTodoKb(compiled)];
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }

  const next = `${JSON.stringify(compiled, null, 2)}\n`;
  const summary = `${JSON.stringify(
    {
      version: 1,
      csv_count: Object.keys(files).length,
      item_kind_count: compiled.itemKinds.length,
      planner_action_count: compiled.plannerActions.length,
      planner_rule_count: compiled.plannerRules.length,
      dashboard_module_count: compiled.dashboardModules.length,
      permission_row_count: compiled.permissions.length,
      data_model_row_count: compiled.dataModel.length,
      a11_count: compiled.a11.length,
    },
    null,
    2,
  )}\n`;

  if (checkOnly) {
    let compiledActual = '';
    let summaryActual = '';
    try {
      compiledActual = readFileSync(compiledPath, 'utf8');
      summaryActual = readFileSync(summaryPath, 'utf8');
    } catch {
      console.error('missing compiled.json or BUILD_SUMMARY.json. Run pnpm todo:kb:build.');
      process.exitCode = 1;
      return;
    }
    if (compiledActual !== next || summaryActual !== summary) {
      console.error('To-Do KB compiled files are stale. Run pnpm todo:kb:build.');
      process.exitCode = 1;
      return;
    }
    console.info(
      `To-Do KB ok: ${compiled.itemKinds.length} kinds, ${compiled.plannerRules.length} rules from data/todo/csv.`,
    );
    return;
  }

  mkdirSync(dirname(compiledPath), { recursive: true });
  writeFileSync(compiledPath, next);
  writeFileSync(summaryPath, summary);
  console.info(`Wrote todo compiled.json (${compiled.plannerRules.length} rules).`);
}

main();
