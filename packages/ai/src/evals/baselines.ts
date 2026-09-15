import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Frozen replies, one JSON file per case, reviewed in the diff like any other
 * fixture. `packages/food/src/sources/fixtures/` already establishes recorded
 * provider JSON as the house pattern.
 *
 * Deliberately NOT vitest snapshots. The repo has zero snapshot tests and
 * should keep it that way here: `-u` silently rewriting a model reply is
 * precisely the failure this whole harness exists to prevent. Re-recording has
 * to be a decision someone makes and someone else reads.
 */

const BASELINE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'baselines');

export type KaiBaseline = {
  caseId: string;
  reply: string;
  source: string;
  recordedAt: string;
  /** Set when recorded, so a baseline from an older persona is obvious. */
  personaVersion?: number;
};

function baselinePath(caseId: string): string {
  if (!/^[a-z0-9-]+$/.test(caseId)) throw new Error(`unsafe case id: ${caseId}`);
  return join(BASELINE_DIR, `${caseId}.json`);
}

export async function readBaseline(caseId: string): Promise<KaiBaseline | null> {
  try {
    return JSON.parse(await readFile(baselinePath(caseId), 'utf8')) as KaiBaseline;
  } catch {
    return null;
  }
}

export async function writeBaseline(
  caseId: string,
  baseline: KaiBaseline,
): Promise<void> {
  await mkdir(BASELINE_DIR, { recursive: true });
  await writeFile(baselinePath(caseId), `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
}
