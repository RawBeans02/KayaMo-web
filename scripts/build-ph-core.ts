import { loadRootEnv } from '../packages/db/src/load-root-env';
import { upsertPhCoreFoods } from '@kayamo/db/ph-core';
import { loadPhCoreYaml } from '@kayamo/food/ph-core-io';
import { toPhCoreFoodRow } from '@kayamo/food';

function printIssues(
  label: string,
  issues: Array<{ id: string; code: string; message: string }>,
): void {
  if (issues.length === 0) return;
  console.error(`${label} (${issues.length}):`);
  for (const issue of issues) {
    console.error(`  - ${issue.id}: [${issue.code}] ${issue.message}`);
  }
}

async function main() {
  loadRootEnv();
  const checkOnly = process.argv.includes('--check');
  const result = loadPhCoreYaml();
  printIssues('Warnings', result.warnings);
  if (result.errors.length > 0) {
    printIssues('Errors', result.errors);
    process.exitCode = 1;
    return;
  }

  console.info(`PH core YAML ok: ${result.foods.length} foods.`);
  if (checkOnly) return;

  const upserted = await upsertPhCoreFoods(result.foods.map(toPhCoreFoodRow));
  console.info(`Upserted ${upserted.foods} foods and ${upserted.servings} servings (source=ph_core).`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`PH core build failed: ${message}`);
  process.exitCode = 1;
});
