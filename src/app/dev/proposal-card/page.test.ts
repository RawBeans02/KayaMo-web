import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('proposal card demo route', () => {
  it('404s in production builds and keeps the gallery import in the else branch', () => {
    expect(page).toContain("process.env.NODE_ENV === 'production'");
    expect(page).toContain('notFound()');
    expect(page).toMatch(/else\s*\{\s*const \{ ProposalCardGallery \}/);
  });
});
