/**
 * Maintained crisis support resources. Appended by safety.ts — not inlined
 * into a system prompt where a model can garble the numbers.
 *
 * Region is derived from the profile timezone the context snapshot already
 * carries, so no new field is threaded through. A user we cannot place gets a
 * region-neutral line rather than numbers they cannot dial: a wrong hotline is
 * worse than no hotline at the moment someone needs one.
 */
export type PhSupportResource = {
  id: string;
  name: string;
  contact: string;
};

export type SupportRegion = 'PH' | 'unknown';

export const PH_SUPPORT_RESOURCES: readonly PhSupportResource[] = [
  { id: 'ncmh-crisis', name: 'NCMH Crisis Hotline', contact: '1553' },
  {
    id: 'hopeline',
    name: 'Hopeline Philippines',
    contact: '2919 (Globe/TM) or (02) 8804-4673',
  },
  {
    id: 'in-touch',
    name: 'In Touch Community Services',
    contact: '+63 2 8893 7603',
  },
];

/** Philippine IANA zones. Kept explicit so adding a region is a data change. */
const PH_TIMEZONES = new Set(['Asia/Manila', 'Asia/Taipei_Manila', 'PHT']);

export function supportRegionFromTimezone(
  timezone: string | null | undefined,
): SupportRegion {
  if (!timezone) return 'unknown';
  return PH_TIMEZONES.has(timezone.trim()) ? 'PH' : 'unknown';
}

/**
 * The neutral line names no number on purpose. Emergency numbers differ by
 * country and we would rather send someone to the one they already know than
 * print a plausible-looking wrong one.
 */
const NEUTRAL_FOOTER =
  'If you are in immediate danger, contact your local emergency number now. A local crisis line can also help.';

export function formatSupportFooter(region: SupportRegion): string {
  if (region !== 'PH') return NEUTRAL_FOOTER;
  const lines = PH_SUPPORT_RESOURCES.map(
    (resource) => `${resource.name}: ${resource.contact}`,
  );
  return `Philippine support: ${lines.join(' · ')}`;
}

/** @deprecated Use `formatSupportFooter(supportRegionFromTimezone(tz))`. */
export function formatPhSupportFooter(): string {
  return formatSupportFooter('PH');
}
