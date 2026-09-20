import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, legalMetadata } from '../legal/legal-page';
import {
  OPERATOR_JURISDICTION,
  OPERATOR_KIND,
  OPERATOR_NAME,
  SUPPORT_EMAIL,
  supportMailto,
} from '@/lib/legal';
import { publicIndexingEnabled, SITE_URL } from '@/lib/site-metadata';

export const metadata: Metadata = {
  ...legalMetadata(
    'Terms',
    'What KayaMo is for, what it is not, and what is expected of the people who use it.',
  ),
  alternates: { canonical: `${SITE_URL}/terms` },
  robots: { index: publicIndexingEnabled(), follow: true },
};

/**
 * Written from docs/legal/terms-of-use-draft.md with the owner's facts. No
 * payment, subscription or refund wording: there is nothing to pay for.
 */
export default function TermsPage() {
  return (
    <LegalPage current="/terms" eyebrow="Terms of use" title="What KayaMo is, and is not.">
      <h2>The service</h2>
      <p>
        KayaMo helps you organise everyday actions and goals and record food and
        workouts. It is provided by {OPERATOR_NAME}, {OPERATOR_KIND} in{' '}
        {OPERATOR_JURISDICTION}. It is a general wellness and personal-organisation
        tool. It is not medical care, a diagnosis, an emergency service, or a promise
        of any particular health, weight or fitness result. There is nothing to pay for.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with your email and a password, handled by Clerk. Keep the password
        to yourself and that inbox secure. You are responsible for what you enter and for checking
        the result of a change before relying on it. Demo entries stay in the browser
        they were made in and do not transfer when you sign in. Work that has not
        synchronised can be lost if browser data is cleared.
      </p>

      <h2>Nutrition and exercise</h2>
      <p>
        Nutrition sources, portions, labels and matches can be incomplete or wrong.
        Every entry shows where its numbers came from and how confident the source
        is; review the food, the source and the quantity before saving. Do not make
        medical, allergy, dietary-treatment or exercise-safety decisions on KayaMo
        alone. Ask a qualified professional when you need advice for your situation,
        and stop and seek help if something feels wrong during activity.
      </p>

      <h2>Lis</h2>
      <p>
        Lis proposes; you confirm. Nothing Lis suggests is written to your records
        until you say yes, and Lis never produces nutrition numbers itself. Its
        replies can still be wrong or incomplete, so read a proposal before
        confirming it. Give Lis access only to the areas you want it to read. AI
        features depend on a provider and on a daily request allowance, and may be
        unavailable. Do not use Lis for emergencies or diagnoses.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not access another person&rsquo;s account, work around access controls or
        request limits, submit malicious content, disrupt the service, or misuse
        someone else&rsquo;s information. Report a suspected security problem privately
        to <a href={supportMailto('KayaMo security')}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Your content</h2>
      <p>
        Your entries are yours. KayaMo processes them only to provide the features you
        use, as described in the <Link href="/privacy">privacy notice</Link>, and does
        not sell your health information or use it for unrelated purposes.
      </p>

      <h2>Availability and support</h2>
      <p>
        Features may be unavailable during failures or maintenance, and KayaMo does not
        guarantee uninterrupted access or the recovery of unsynchronised or demo
        entries. Support is by email at{' '}
        <a href={supportMailto('KayaMo support')}>{SUPPORT_EMAIL}</a>, handled by the
        operator directly; no round-the-clock or emergency response is promised.
        Signing out does not delete an account, and there is no automated export or
        deletion yet: ask support for either.
      </p>

      <h2>Law and disputes</h2>
      <p>
        These terms are governed by the law of {OPERATOR_JURISDICTION}. Nothing in
        them takes away rights that Philippine law gives you and does not allow to be
        waived. The wording on liability, ending an account and settling disputes has
        not yet been reviewed by a lawyer; until it has, this page describes intent
        rather than a settled contract, and the draft notice above stays.
      </p>
    </LegalPage>
  );
}
