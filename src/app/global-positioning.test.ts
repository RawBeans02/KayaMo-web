import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('global product positioning', () => {
  for (const path of ['src/app/landing/landing.tsx', 'src/app/login/login-view.tsx']) {
    it(`${path} promotes personal growth without forced regional branding`, () => {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain('Personal growth, on your terms.');
      expect(source).not.toMatch(/Made for the Philippines|familiar Filipino portions|Kasama mo si Mus|Kaya mo\. One day/);
      expect(source).not.toMatch(/every food in the world|all the food in the world/i);
    });
  }

  it('preserves English defaults and explicit existing translation choices', () => {
    const source = readFileSync('src/app/layout.tsx', 'utf8');
    expect(source).toContain("?l:'en'");
    expect(source).toContain("localStorage.getItem('kayamo:locale')");
  });

  it('does not exclude international providers from the quick-entry catalog', () => {
    const source = readFileSync('packages/features/src/food/command-log-model.ts', 'utf8');
    expect(source).toContain("['ph_core', 'user', 'usda_fdc', 'off']");
    expect(source).not.toContain('Create it in PH core');
  });
});
