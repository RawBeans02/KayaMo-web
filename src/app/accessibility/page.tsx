import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '../legal/legal-page';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/legal';
import { publicIndexingEnabled, SITE_URL } from '@/lib/site-metadata';

export const metadata: Metadata = {
  ...legalMetadata(
    'Accessibility',
    'What KayaMo does for accessibility, what has been tested, and how to report a problem.',
  ),
  alternates: { canonical: `${SITE_URL}/accessibility` },
  robots: { index: publicIndexingEnabled(), follow: true },
};

/**
 * Written from docs/legal/accessibility-statement-draft.md. The claims match
 * what the automated suite checks on every commit; what it cannot check is
 * named as such.
 */
export default function AccessibilityPage() {
  return (
    <LegalPage
      current="/accessibility"
      eyebrow="Accessibility statement"
      title="Usable by more people, on purpose."
    >
      <h2>The aim</h2>
      <p>
        KayaMo should be usable by people with a range of abilities and access needs.
        The target is WCAG 2.2 Level AA. That is a target the work is measured
        against, not a claim that every criterion has been independently verified.
      </p>

      <h2>What is in place</h2>
      <ul>
        <li>Labelled navigation and landmarks, with a skip link to the content.</li>
        <li>
          Every control reachable by keyboard, with a visible focus ring that follows
          the control&rsquo;s shape.
        </li>
        <li>Light, dark and system appearance, and a Reduce Transparency switch.</li>
        <li>
          Reduced motion, reduced transparency and increased contrast honoured from
          your system settings; Windows High Contrast draws real borders.
        </li>
        <li>Text sized in relative units, so your browser&rsquo;s text-size setting applies.</li>
        <li>Touch targets of at least 44 pixels, and layouts that work down to 320 pixels wide.</li>
        <li>
          Text on glass kept at a 4.5:1 contrast ratio, checked with the surface made
          opaque.
        </li>
      </ul>

      <h2>How it is tested</h2>
      <p>
        Every change runs automated accessibility checks on every screen, in three
        browser engines, plus keyboard tests of the focus ring and the dialogs, and a
        reflow check at 320 pixels and 200% text size. Automated checks cannot
        establish complete accessibility: real screen-reader use and the final hosted
        release still need a review by people, and that review has not happened yet.
      </p>

      <h2>Known limits</h2>
      <ul>
        <li>Screen-reader speech output has not been reviewed on the current design.</li>
        <li>
          Lis&rsquo;s face is decorative and carries no text; the name beside it is what
          assistive technology reads.
        </li>
        <li>The Movement and planner screens from the earlier design are not yet on the new system.</li>
      </ul>

      <h2>Tell us</h2>
      <p>
        Something unreadable or unreachable is a bug. Email{' '}
        <a href={supportMailto('KayaMo accessibility')}>{SUPPORT_EMAIL}</a> with the
        page, what you were trying to do, and, if you like, the browser or assistive
        technology you use. Do not include passwords, sign-in links or health records;
        screenshots are optional. Support is handled by the operator directly and no
        response time is promised, but every report is read.
      </p>
    </LegalPage>
  );
}
