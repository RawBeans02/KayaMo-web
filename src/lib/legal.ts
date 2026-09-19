/**
 * The facts the legal pages are written from. One place, so a change (a
 * domain email, a registered business name, an approval date) is one edit.
 *
 * Given by the owner on 2026-09-19. The pages stay marked as drafts until the
 * owner sets `LEGAL_APPROVED_ON`; until then they say what KayaMo intends and
 * how it behaves today, and nothing they say has been reviewed by a lawyer.
 */
export const OPERATOR_NAME = 'Rovince Eduvane';
export const OPERATOR_KIND = 'an individual';
export const OPERATOR_JURISDICTION = 'the Republic of the Philippines';
export const PRIVACY_LAW = 'the Data Privacy Act of 2012 (Republic Act No. 10173)';

/** Placeholder until a kayamo.fit address exists; the owner reads this one. */
export const SUPPORT_EMAIL = 'rovseduvs@gmail.com';

/** The date the current wording was written. Shown on every legal page. */
export const LEGAL_UPDATED_ON = '2026-09-19';

/** Set when the owner approves the texts; null keeps the draft banner on. */
export const LEGAL_APPROVED_ON: string | null = null;

export const LEGAL_ROUTES = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/accessibility', label: 'Accessibility' },
] as const;

export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
