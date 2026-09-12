'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/shell/theme-toggle';
import { useSearchParams } from 'next/navigation';
import { useDeskLocale } from '@kayamo/features/desktop';
import { LoginForm } from './login-form';
import { LoginTheme } from './login-theme';
import styles from './login.module.css';

export function LoginView({ localDev }: { localDev: boolean }) {
  const params = useSearchParams();
  const locale = useDeskLocale();
  const fromDemo = params.get('from') === 'demo';
  const sent = params.get('sent') === '1';
  const setup = params.get('setup') === '1';
  const error = params.get('error');
  return (
    <main className={styles.viewport}>
      <LoginTheme />
      <header className={styles.nav}>
        <Link href="/" className={styles.wordmark} aria-label="KayaMo home">
          KayaMo
        </Link>
        <div className={styles.navActions}>
          <ThemeToggle />
          <Link className={styles.back} href={fromDemo ? '/today' : '/'}>
            {fromDemo ? 'Back to your demo' : 'Back to home'}{' '}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <div className={styles.shell}>
        <section className={styles.signIn} aria-labelledby="login-title">
          <p className={styles.eyebrow}>Your everyday, in one place</p>
          <h1 id="login-title">
            {locale === 'en' ? 'Sign in to KayaMo.' : 'Tuloy ka sa KayaMo.'}
          </h1>
          <p className={styles.intro}>
            Enter your email. We’ll send you a sign-in link—no password needed.
          </p>
          {fromDemo ? (
            <p className={styles.demoNote}>
              Your demo stays in this browser. Signing in does not transfer those entries
              to your account yet.
            </p>
          ) : null}
          <div className={styles.form}>
            <LoginForm sent={sent} setup={setup} error={error} localDev={localDev} />
          </div>
          <details className={styles.help}>
            <summary>Need help signing in?</summary>
            <p>
              Check your spam folder and make sure the email address is right. If your
              link has expired, request a new one here and use the latest email.
            </p>
          </details>
        </section>
        <aside className={styles.welcome} aria-label="Welcome to KayaMo">
          <p className={styles.eyebrow}>Kaya mo. One day at a time.</p>
          <h2>
            A little more room
            <br />
            for your everyday.
          </h2>
          <p>
            Your meals, your training, your next small step. Pick up where you left off.
          </p>
          <div className={styles.companion}>
            <Image
              className={styles.mus}
              src="/botanical/mus-neutral.webp"
              alt="Mus, your seed companion"
              width={160}
              height={160}
              sizes="160px"
            />
            <p>
              <strong>Kasama mo si Mus.</strong>A little encouragement along the way.
            </p>
          </div>
          <span className={styles.signature}>
            Made for the everyday. Made for the Philippines.
          </span>
        </aside>
      </div>
      <footer className={styles.footer}>
        Small steps. Meaningful goals. Room to grow.
      </footer>
    </main>
  );
}
