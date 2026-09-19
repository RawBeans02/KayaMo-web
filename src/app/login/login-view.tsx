'use client';
import Link from 'next/link';
import { ThemeToggle } from '@/shell/theme-toggle';
import { useSearchParams } from 'next/navigation';
import { useDeskLocale } from '@kayamo/features/desktop';
import { LoginForm } from './login-form';
import { LoginTheme } from './login-theme';
import { LEGAL_ROUTES } from '@/lib/legal';
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
          <span className={styles.wordmarkTile} aria-hidden="true" />
          KayaMo
        </Link>
        <div className={styles.navActions}>
          <ThemeToggle />
          <Link className={styles.back} href={fromDemo ? '/today' : '/'}>
            <span className={styles.backLong}>
              {fromDemo ? 'Back to your demo' : 'Back to home'}
            </span>
            <span className={styles.backShort}>Back</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <div className={styles.shell}>
        <section className={`${styles.signIn} kgSurface`} aria-labelledby="login-title">
          <h1 id="login-title">
            {locale === 'en' ? 'Sign in to KayaMo.' : 'Tuloy ka sa KayaMo.'}
          </h1>
          <p className={styles.intro}>
            Enter your email. We’ll send you a sign-in link, no password needed.
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
          <p className={`kgEyebrow ${styles.eyebrow}`}>Small steps. One day at a time.</p>
          {/* The break is hidden below 480px, so the space before it matters. */}
          <h2>
            A little more room{' '}
            <br />
            for your everyday.
          </h2>
          <p>
            Your meals, your training, your next small step. Pick up where you left off.
          </p>
          <span className={styles.signature}>
            Personal growth, on your terms.
          </span>
        </aside>
      </div>
      <footer className={styles.footer}>
        <span>Small steps. Meaningful goals. Room to grow.</span>
        <nav className={styles.footerLinks} aria-label="Legal">
          {LEGAL_ROUTES.map((route) => (
            <Link key={route.href} href={route.href}>
              {route.label}
            </Link>
          ))}
        </nav>
      </footer>
    </main>
  );
}
