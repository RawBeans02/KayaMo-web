import { requireShellUserId } from '@/lib/shell-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { AppearanceSettings } from '@/shell/appearance-settings';
import { CompanionSettings } from '@/shell/companion-settings';
import { SignOutButton } from '@/shell/sign-out-button';
import { BotanicalIcon } from '@kayamo/features/desktop';
import { LEGAL_ROUTES, SUPPORT_EMAIL, supportMailto } from '@/lib/legal';
import styles from '@/shell/settings.module.css';

export const metadata = { title: 'Profile' };

/** Two letters for the account circle, derived from whatever we actually know. */
function initials(email: string | null) {
  const local = (email ?? '').split('@')[0] ?? '';
  const parts = local.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const first = parts[0] ?? '';
  const second = parts[1] ?? '';
  const letters = second ? first.charAt(0) + second.charAt(0) : local.slice(0, 2);
  return (letters || 'You').toUpperCase().slice(0, 2);
}

export default async function SettingsPage() {
  const userId = await requireShellUserId();
  const guest = userId.startsWith('guest-');

  let email: string | null = null;
  if (!guest) {
    try {
      const supabase = await createServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      email = user?.email ?? null;
    } catch {
      email = null;
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className="kgTitle">Profile</h1>
      </header>

      {/* ── Account ── */}
      {guest ? (
        <a
          className={`${styles.account} kgSurface`}
          href="/login?from=demo"
          aria-label="Demo guest. Sign in or create an account"
        >
          <span className={styles.avatar} aria-hidden="true">
            D
          </span>
          <span className={styles.accountBody}>
            <span className={styles.accountName}>Demo guest</span>
            <span className={styles.accountMeta}>
              Entries stay in this browser · sign in to keep them
            </span>
          </span>
          <span className={styles.caret} aria-hidden="true">
            <BotanicalIcon name="next" size={20} />
          </span>
        </a>
      ) : (
        <section className={`${styles.account} kgSurface`} aria-label="Account">
          <h2 className={styles.srOnly}>Account</h2>
          <span className={styles.avatar} aria-hidden="true">
            {initials(email)}
          </span>
          <div className={styles.accountBody}>
            <p className={styles.accountName}>{email ?? 'Signed in'}</p>
            <p className={styles.accountMeta}>Entries sync to your account</p>
          </div>
        </section>
      )}

      {/* ── Appearance ── */}
      <AppearanceSettings />

      {/* ── Data ── */}
      <section className={`${styles.list} kgSurface`} aria-label="Data">
        <h2 className={styles.srOnly}>Data</h2>

        <a className={styles.row} href="/mus">
          <span className={styles.lisMark} aria-hidden="true">
            <BotanicalIcon name="lis" size={17} weight="fill" />
          </span>
          <span className={styles.rowLabel}>
            Lis access and proposals
            <small className={styles.rowNote}>
              Lis proposes; nothing is written to your diary until you confirm it.
            </small>
          </span>
          <span className={styles.caret} aria-hidden="true">
            <BotanicalIcon name="next" size={20} />
          </span>
        </a>

        <details className={styles.details}>
          <summary className={styles.row}>
            <span className={styles.lisMark} aria-hidden="true">
              <BotanicalIcon name="lis" size={17} weight="fill" />
            </span>
            <span className={styles.rowLabel}>
              How Lis speaks to you
              <small className={styles.rowNote}>
                Your name, and how much encouragement, firmness and humour you want.
              </small>
            </span>
            <span className={styles.caret} aria-hidden="true">
              <BotanicalIcon name="next" size={20} />
            </span>
          </summary>
          <div className={styles.detailsBody}>
            <CompanionSettings />
          </div>
        </details>

        <details className={styles.details}>
          <summary className={styles.row}>
            <span className={styles.rowIcon} aria-hidden="true">
              <BotanicalIcon name="privacy" size={22} />
            </span>
            <span className={styles.rowLabel}>Privacy &amp; accessibility</span>
            <span className={styles.caret} aria-hidden="true">
              <BotanicalIcon name="next" size={20} />
            </span>
          </summary>
          <div className={styles.detailsBody}>
            <p>
              <strong>Your records.</strong> Demo entries are held in this browser
              and never reach a server. With an account, entries sync to your own
              row and are readable only by you.
            </p>
            <p>
              <strong>Lis.</strong> Lis reads only what a screen hands it for the
              question you asked, writes nothing without your confirmation, and
              never produces nutrition numbers itself. Those come from the food
              catalog.
            </p>
            <p>
              <strong>Accessibility.</strong> This app honours Reduce Motion,
              Reduce Transparency and Increase Contrast from your system, and the
              switch above overrides transparency for this browser. Every control
              is reachable by keyboard with a visible focus ring, targets are at
              least 44px, and text keeps a 4.5:1 contrast ratio on glass.
            </p>
            <p>
              Something unreadable or unreachable is a bug. Tell us at{' '}
              <a className={styles.link} href={supportMailto('KayaMo accessibility')}>
                {SUPPORT_EMAIL}
              </a>{' '}
              and we will fix it.
            </p>
            <p>
              The full texts:{' '}
              {LEGAL_ROUTES.map((route, index) => (
                <span key={route.href}>
                  {index > 0 ? ' · ' : ''}
                  <a className={styles.link} href={route.href}>
                    {route.label}
                  </a>
                </span>
              ))}
              .
            </p>
          </div>
        </details>

        <div className={`${styles.row} ${styles.rowInert}`}>
          <span className={styles.rowIcon} aria-hidden="true">
            <BotanicalIcon name="download" size={22} />
          </span>
          <span className={styles.rowLabel}>
            Export my data
            <small className={styles.rowNote}>
              Not available on the web yet. Email{' '}
              <a className={styles.link} href={supportMailto('KayaMo data request')}>
                {SUPPORT_EMAIL}
              </a>{' '}
              for a copy of your records.
            </small>
          </span>
        </div>

        <div className={`${styles.row} ${styles.rowInert} ${styles.danger}`}>
          <span className={styles.rowIcon} aria-hidden="true">
            <BotanicalIcon name="trash" size={22} />
          </span>
          <span className={styles.rowLabel}>
            Delete account
            <small className={styles.rowNote}>
              Not available on the web yet. Email{' '}
              <a className={styles.link} href={supportMailto('KayaMo account deletion')}>
                {SUPPORT_EMAIL}
              </a>{' '}
              from your sign-in address.
            </small>
          </span>
        </div>
      </section>

      {/* ── Sign out ── */}
      {guest ? (
        <p className={styles.status}>
          You are using the local demo. Demo entries will not transfer to an
          account.{' '}
          <a className={styles.link} href="/login?from=demo">
            Sign in or create an account
          </a>
          .
        </p>
      ) : (
        <div className={styles.signOut}>
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
