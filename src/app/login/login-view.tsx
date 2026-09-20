'use client';
import { SignIn, SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { ThemeToggle } from '@/shell/theme-toggle';
import { useSearchParams } from 'next/navigation';
import { useDeskLocale } from '@kayamo/features/desk-locale';
import { LOCAL_DEV_EMAIL } from '@kayamo/features/auth';
import { LoginTheme } from './login-theme';
import { CLERK_BRIDGE_PATH } from '@/lib/clerk';
import { LEGAL_ROUTES, SUPPORT_EMAIL, supportMailto } from '@/lib/legal';
import styles from './login.module.css';

/**
 * The entry surface. Clerk draws the form (sign-in or sign-up, password,
 * reset, the lot); the card, the header, the demo note and the legal footer
 * are ours. After Clerk finishes it sends the person to /auth/bridge, which
 * mints the Supabase session and opens the workspace.
 */
export function LoginView({
  localDev,
  clerk,
  mode = 'sign-in',
}: {
  localDev: boolean;
  /** False when the publishable key is absent: the page says so, the demo still runs. */
  clerk: boolean;
  mode?: 'sign-in' | 'sign-up';
}) {
  const params = useSearchParams();
  const locale = useDeskLocale();
  const fromDemo = params.get('from') === 'demo';
  const setup = params.get('setup') === '1';
  const error = params.get('error');
  const next = params.get('next');
  const bridge = next ? `${CLERK_BRIDGE_PATH}?next=${encodeURIComponent(next)}` : CLERK_BRIDGE_PATH;
  const signUp = mode === 'sign-up';
  return (
    <main className={styles.viewport} data-login-mode={mode}>
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
            {signUp
              ? locale === 'en'
                ? 'Create your KayaMo account.'
                : 'Gumawa ng KayaMo account.'
              : locale === 'en'
                ? 'Sign in to KayaMo.'
                : 'Tuloy ka sa KayaMo.'}
          </h1>
          <p className={styles.intro}>
            {signUp
              ? 'An email and a password is all it takes. You can change either later.'
              : 'Your email and password, or the account you signed up with.'}
          </p>
          {fromDemo ? (
            <p className={styles.demoNote}>
              Your demo stays in this browser. Signing in does not transfer those entries
              to your account yet.
            </p>
          ) : null}
          {setup ? (
            <p className={styles.banner} data-kind="warn" role="status">
              Supabase env is empty. Copy <code>.env.example</code> to <code>.env.local</code>
              , run <code>npx supabase start</code>, then paste the URL and keys from{' '}
              <code>npx supabase status</code>.
            </p>
          ) : null}
          {error ? (
            <p className={styles.banner} data-kind="warn" role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.form} data-login-form={clerk ? 'clerk' : 'unconfigured'}>
            {clerk ? (
              signUp ? (
                <SignUp
                  routing="hash"
                  signInUrl="/login"
                  forceRedirectUrl={bridge}
                  appearance={CLERK_APPEARANCE}
                />
              ) : (
                <SignIn
                  routing="hash"
                  signUpUrl="/sign-up"
                  forceRedirectUrl={bridge}
                  appearance={CLERK_APPEARANCE}
                />
              )
            ) : (
              <p className={styles.banner} data-kind="warn" role="status">
                Sign-in is not configured on this deployment. Set{' '}
                <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code>.
                The demo on the home page works without them.
              </p>
            )}
            {localDev ? (
              <form action="/api/auth/local-dev" method="post" className={styles.local}>
                <button type="submit" className="kgGhost" style={{ width: '100%' }}>
                  Skip login on this machine
                </button>
                <p>Signs you in as {LOCAL_DEV_EMAIL}. Hidden in production.</p>
              </form>
            ) : null}
          </div>
          <details className={styles.help}>
            <summary>Need help signing in?</summary>
            <p>
              Forgot your password? Use the link on the form and a reset code is emailed
              to you. Anything else, write to{' '}
              <a href={supportMailto('KayaMo sign-in')}>{SUPPORT_EMAIL}</a>.
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

/** Clerk's card sits inside our glass card: no second surface, our accent. */
const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: '#30d158',
    borderRadius: '18px',
    fontFamily: 'inherit',
  },
  elements: {
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: 'none', border: 0 },
    card: { boxShadow: 'none', background: 'transparent', padding: 0 },
    header: { display: 'none' },
    footer: { background: 'transparent' },
  },
} as const;
