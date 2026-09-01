import { describe, expect, it } from 'vitest';
import { PACKAGE } from './index';

describe('@kayamo/food', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/food');
  });
});

describe('client barrel', () => {
  it('does not re-export the YAML file loader', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch('ph-core/io');
    expect(src).not.toMatch('catalog-yaml');
    expect(src).not.toMatch('loadPhCoreYaml');
  });
});
