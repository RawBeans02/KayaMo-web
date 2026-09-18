import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe('root app entry into @kayamo/features', () => {
  // The main barrel re-exports the phone screens and their stylesheet. Any
  // client import of it drags them into every route's graph. Root code uses
  // the web entry, @kayamo/features/desktop, or a named subpath.
  it('never imports the main barrel', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((file) =>
      /from\s+['"]@kayamo\/features['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
