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

  // The web entry pulls the whole app (tables, the Lis thread, the palette,
  // Supabase, Dexie) into the client graph. A public page, which a visitor
  // pays for before deciding anything, imports leaf entries instead: on
  // 2026-09-19 the landing shipped 465 KB of gzipped JavaScript because its
  // icons came from the desktop barrel.
  it('public pages never import the desktop barrel', () => {
    const publicDirs = ['src/app/landing', 'src/app/login', 'src/app/legal', 'src/app/privacy', 'src/app/terms', 'src/app/accessibility'];
    const publicFiles = [
      ...publicDirs.flatMap((dir) => sourceFiles(join(process.cwd(), dir))),
      join(process.cwd(), 'src/shell/theme-toggle.tsx'),
      join(process.cwd(), 'src/app/not-found.tsx'),
      join(process.cwd(), 'src/app/error.tsx'),
    ];
    const offenders = publicFiles.filter((file) =>
      /from\s+['"]@kayamo\/features\/desktop['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
