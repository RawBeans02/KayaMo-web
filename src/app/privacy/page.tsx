import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '../legal/legal-page';
import {
  OPERATOR_JURISDICTION,
  OPERATOR_KIND,
  OPERATOR_NAME,
  PRIVACY_LAW,
  SUPPORT_EMAIL,
  supportMailto,
} from '@/lib/legal';
import { publicIndexingEnabled, SITE_URL } from '@/lib/site-metadata';

export const metadata: Metadata = {
  ...legalMetadata(
    'Privacy',
    'What KayaMo records, why, who processes it, and how to ask for access or deletion.',
  ),
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: publicIndexingEnabled(), follow: true },
};

/**
 * Written from docs/legal/privacy-notice-draft.md with the owner's facts and
 * the bracketed placeholders resolved into plain statements of what is true
 * today. Where something is not implemented (export, automatic deletion, an
 * age gate) the page says so rather than promising it.
 */
export default function PrivacyPage() {
  return (
    <LegalPage current="/privacy" eyebrow="Privacy notice" title="What KayaMo keeps, and why.">
      <h2>Who is responsible</h2>
      <p>
        KayaMo is a personal-growth website operated by {OPERATOR_NAME}, {OPERATOR_KIND}{' '}
        in {OPERATOR_JURISDICTION}. Personal information is handled under {PRIVACY_LAW}.
        The operator is the contact for every question and request on this page:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>What the website uses</h2>
      <ul>
        <li>
          <strong>Account access:</strong> your email address, an account identifier,
          and the session information that keeps you signed in and keeps your data
          separate from everyone else&rsquo;s. There are no passwords; sign-in is by
          emailed link.
        </li>
        <li>
          <strong>Your entries:</strong> what you choose to record, such as goals,
          tasks, food and quantities, workouts and preferences. Food and workout
          records are health information, which is sensitive personal information
          under Philippine law.
        </li>
        <li>
          <strong>Lis:</strong> the messages you send to the assistant and any context
          you have allowed it to read. Saving a record is not permission for Lis to
          read it; each area of your data has its own switch on the Lis screen, off
          by default.
        </li>
        <li>
          <strong>Food searches:</strong> the search text or barcode you submit is sent
          to the nutrition sources named below when you use online search. Your diary
          and your account identifier are not sent with it.
        </li>
        <li>
          <strong>Browser storage:</strong> your entries and sync state, your
          appearance choices, and the identifiers a session or the demo needs.
        </li>
        <li>
          <strong>Support:</strong> anything you choose to write to the support
          address.
        </li>
        <li>
          <strong>Operations:</strong> the hosting and service providers below process
          the technical request and security information any website needs.
        </li>
      </ul>

      <h2>Why</h2>
      <p>
        To sign you in, save and synchronise your entries, run the food searches and
        Lis conversations you ask for, remember your preferences, answer support
        requests, and keep the service safe. Turning off Lis&rsquo;s access to an area
        stops future reads; it does not retract what was already sent to the AI
        provider in an earlier conversation, and it does not delete that conversation.
      </p>

      <h2>The demo and signed-in use</h2>
      <p>
        The demo keeps its entries in your browser and sends them to no server.
        Clearing browser data removes them, and signing in does not transfer them to
        an account. Signed-in entries are also stored in your browser first, so the
        app works offline, and synchronise to your account when a connection is
        available. Signing out does not delete your account data.
      </p>

      <h2>Service providers</h2>
      <p>
        KayaMo runs on Supabase (accounts and data) and Vercel (hosting). Lis uses
        OpenAI for the AI features. Online food lookups use USDA FoodData Central and
        Open Food Facts. Support email is handled through Google&rsquo;s mail service.
        These providers operate outside the Philippines, so information they process
        crosses borders. KayaMo does not claim that any provider keeps zero copies or
        excludes your data from its own processing beyond what its terms say.
      </p>

      <h2>How long, and your requests</h2>
      <p>
        There is no automatic deletion schedule yet. Entries are kept until you delete
        them in the app or ask for your account to be removed. Deleted records are
        marked rather than erased immediately, so they can be undone and synchronised;
        the operator has not yet set how long those marked rows and the service
        backups are retained, and will publish that schedule here when it is decided.
      </p>
      <p>
        To see, correct or delete your information, or to close your account, email{' '}
        <a href={supportMailto('KayaMo data request')}>{SUPPORT_EMAIL}</a> from the
        address you sign in with. The operator may ask you to confirm control of the
        account before acting. There is no self-service export or account deletion in
        the app yet; requests are handled by hand.
      </p>

      <h2>Security</h2>
      <p>
        Every record is scoped to the account that created it and enforced at the
        database, and test accounts are kept apart from real ones. No system is
        perfectly secure. Never send passwords, sign-in links, keys or medical records
        to support; report a security concern privately to the same address. KayaMo
        does not sell personal health data and does not use it for advertising.
      </p>

      <h2>Age</h2>
      <p>
        KayaMo is intended for adults, 18 and over. The website does not verify age
        today. It is not designed for children, and there is no children&rsquo;s
        version.
      </p>

      <h2>Changes</h2>
      <p>
        When this notice changes in a way that matters, the revised version and its
        date are published here. A new use of your data is a new decision, not a quiet
        extension of what Lis is already allowed to read.
      </p>
    </LegalPage>
  );
}
