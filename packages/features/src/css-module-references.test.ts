import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A CSS module is typed as Record<string, string>, so `styles.tpyo` compiles
 * and renders an undefined class with no error anywhere. This walks every
 * component that imports a *.module.css and checks that each class it
 * references is defined in that file. It guards the design phase, where
 * stylesheets are being split by owner and renamed.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules') walk(path, out);
    } else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

function definedClasses(css: string): Set<string> {
  const withoutGlobals = css.replace(/:global\([^)]*\)/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // selectors only: everything outside `{ ... }` declaration blocks
  const selectors = withoutGlobals.replace(/\{[^{}]*\}/g, '{}');
  return new Set([...selectors.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]!));
}

describe('CSS module references', () => {
  const roots = [resolve(__dirname), resolve(__dirname, '../../../src')];
  const files = roots.flatMap((root) => walk(root));
  const importRe = /import\s+(\w+)\s+from\s+'([^']+\.module\.css)'/g;

  it('every styles.<name> the components use exists in the module they import', () => {
    const dangling: string[] = [];
    let checked = 0;
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(importRe)) {
        const [, alias, spec] = match;
        // Root files use the tsconfig alias `@/` for src/.
        const cssPath = spec!.startsWith('@/')
          ? resolve(__dirname, '../../../src', spec!.slice(2))
          : resolve(dirname(file), spec!);
        const defined = definedClasses(readFileSync(cssPath, 'utf8'));
        const refs = new Set<string>([
          ...[...source.matchAll(new RegExp(`\\b${alias}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g'))].map((m) => m[1]!),
          ...[...source.matchAll(new RegExp(`\\b${alias}\\['([A-Za-z_][A-Za-z0-9_-]*)'\\]`, 'g'))].map((m) => m[1]!),
        ]);
        for (const ref of refs) {
          checked += 1;
          if (!defined.has(ref)) dangling.push(`${file.replace(process.cwd() + '/', '')}: ${alias}.${ref} not in ${spec}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(dangling).toEqual([]);
  });
});
