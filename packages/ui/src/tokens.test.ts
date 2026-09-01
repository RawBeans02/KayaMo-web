import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

describe('desktop palette tokens', () => {
  it('uses the design cream / evergreen values, not the cancelled blue set', () => {
    expect(tokens).toContain('--color-bg: #f7f2e7');
    expect(tokens).toContain('--color-accent: #1f4d3a');
    expect(tokens).not.toContain('#1463ff');
    expect(tokens).not.toContain('#2a1b3d');
  });

  it('declares the five new mapping-table tokens in both themes', () => {
    for (const name of [
      '--color-muted-2',
      '--color-line-strong',
      '--color-proposal',
      '--color-source-usda',
      '--color-source-user',
    ]) {
      expect(tokens.split(name).length).toBeGreaterThan(2);
    }
  });

  it('keeps night ground and mustard accent', () => {
    expect(tokens).toContain('--color-bg: #101a16');
    expect(tokens).toMatch(/html\[data-kayamo-theme='night'\][\s\S]*--color-accent: #d4a72c/);
  });
});
