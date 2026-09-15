/**
 * Shame vocabulary that must not appear in prompt templates or UI copy.
 * The safety module and this file are allowlisted by the sweep test because
 * they name the ban.
 */
export const BANNED_COPY_PATTERNS = [
  { id: 'cheat', pattern: /\bcheat\b/i },
  { id: 'guilty', pattern: /\bguilty\b/i },
  { id: 'earned', pattern: /\bearned\b/i },
  { id: 'burn it off', pattern: /\bburn it off\b/i },
  { id: 'bad food', pattern: /\bbad food\b/i },
  { id: 'sinful', pattern: /\bsinful\b/i },
  // The assistant is called Kai. "Mus" and "Coco" are former names that still
  // surfaced on error and crisis paths — the worst moment to look unfinished.
  // Case-sensitive with word boundaries, so route paths like /api/mus and
  // identifiers like musEntrySchema are untouched.
  { id: 'former brand name', pattern: /\b(?:Mus|Coco)\b/ },
] as const;

export type BannedCopyHit = {
  id: string;
  excerpt: string;
};

/** Pull quoted strings, templates, and JSX text — skip identifiers like `earned_at`. */
export function extractCopyChunks(source: string): string[] {
  const chunks: string[] = [];
  const stringRe = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match: RegExpExecArray | null;
  while ((match = stringRe.exec(source))) {
    const body = match[2];
    if (body === undefined) continue;
    chunks.push(body.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  const jsxRe = />([^<>{}]+)</g;
  while ((match = jsxRe.exec(source))) {
    const raw = match[1];
    if (raw === undefined) continue;
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text) chunks.push(text);
  }
  return chunks;
}

export function findBannedCopy(source: string): BannedCopyHit[] {
  const hits: BannedCopyHit[] = [];
  for (const chunk of extractCopyChunks(source)) {
    for (const banned of BANNED_COPY_PATTERNS) {
      if (!banned.pattern.test(chunk)) continue;
      const excerpt = chunk.replace(/\s+/g, ' ').trim().slice(0, 120);
      hits.push({ id: banned.id, excerpt });
    }
  }
  return hits;
}
