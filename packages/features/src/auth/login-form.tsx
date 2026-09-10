'use client';

import { createBrowserSupabase } from '@kayamo/db';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { authRedirectTo, type AuthRedirectPorts } from '../ports';
import styles from './login-form.module.css';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.6 7.5l6.3 5.3C38.9 37.3 44 31.5 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function LoginForm({
  ports,
  sent,
  error,
  setup,
  localDev,
  localDevAction,
  localDevEmail,
  magicLinkOnly = false,
}: {
  ports: AuthRedirectPorts;
  sent: boolean;
  error: string | null;
  setup: boolean;
  localDev: boolean;
  localDevAction?: string;
  localDevEmail?: string;
  /** Desktop web: magic link only. PWA keeps Google until both surfaces stabilize. */
  magicLinkOnly?: boolean;
}) {
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverErrorDismissed, setServerErrorDismissed] = useState(false);
  const [clientSent, setClientSent] = useState(sent);
  const [sentEmail, setSentEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const retryAt = useRef(0);
  const cooldownActive = cooldown > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);
  const errorId = useId();

  useEffect(() => {
    if (!cooldownActive) return;
    const timer = window.setInterval(
      () => setCooldown(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000))),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldownActive]);

  function startCooldown() {
    retryAt.current = Date.now() + 60_000;
    setCooldown(60);
  }

  async function onEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current || cooldown > 0) return;
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!email) {
      setClientError('Email is required');
      return;
    }
    setPending('email');
    setClientError(null);
    setClientSent(false);
    setServerErrorDismissed(true);
    requestInFlight.current = true;
    try {
      const supabase = createBrowserSupabase();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authRedirectTo(ports) },
      });
      if (otpError) {
        setClientError(
          otpError.status === 429
            ? 'Too many requests. Please wait a minute before trying again.'
            : 'We couldn’t send the sign-in link. Check your email address and try again.',
        );
        if (otpError.status === 429) startCooldown();
        return;
      }
      setSentEmail(email);
      setClientSent(true);
      startCooldown();
    } catch {
      setClientError('Could not connect. Check your connection and try again.');
    } finally {
      requestInFlight.current = false;
      setPending(null);
    }
  }

  async function onGoogle() {
    setPending('google');
    setClientError(null);
    const supabase = createBrowserSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectTo(ports) },
    });
    setPending(null);
    if (oauthError) setClientError(oauthError.message);
  }

  const shownError = clientError ?? (serverErrorDismissed ? null : error);
  const shownSent = clientSent;

  return (
    <div className={styles.root}>
      {setup ? (
        <p className={styles.banner} data-kind="warn" role="status">
          Supabase env is empty. Copy <code>.env.example</code> to <code>.env.local</code>
          , run <code>npx supabase start</code>, then paste the URL and keys from{' '}
          <code>npx supabase status</code>.
        </p>
      ) : null}

      {shownSent ? (
        <p className={styles.banner} data-kind="ok" role="status">
          {magicLinkOnly ? (
            <>
              Check your inbox
              {sentEmail ? (
                <>
                  {' '}
                  at <strong>{sentEmail}</strong>
                </>
              ) : null}
              . Open the latest email to sign in. Can’t find it? Check your spam folder.
            </>
          ) : (
            'Check your inbox for your sign-in link.'
          )}
        </p>
      ) : null}

      {shownError ? (
        <p className={styles.banner} data-kind="warn" role="alert" id={errorId}>
          {shownError}
        </p>
      ) : null}

      <form
        onSubmit={(event) => void onEmail(event)}
        className={styles.stack}
        aria-busy={pending === 'email'}
      >
        <label className={styles.field}>
          <span>Email</span>
          <input
            ref={inputRef}
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            aria-describedby={shownError ? errorId : undefined}
            readOnly={pending === 'email'}
            onChange={() => {
              setClientSent(false);
              setClientError(null);
              setServerErrorDismissed(true);
            }}
          />
        </label>
        <button
          type="submit"
          className={styles.primary}
          disabled={setup || pending !== null || cooldown > 0}
        >
          {pending === 'email'
            ? 'Sending…'
            : cooldown > 0
              ? `Request another link in ${cooldown}s`
              : magicLinkOnly
                ? shownSent
                  ? 'Resend sign-in link'
                  : 'Email me a sign-in link'
                : 'Send magic link'}
        </button>
      </form>

      {shownSent ? (
        <button
          type="button"
          className={styles.ghost}
          onClick={() => {
            setClientSent(false);
            setClientError(null);
            inputRef.current?.focus();
            inputRef.current?.select();
          }}
        >
          Use a different email
        </button>
      ) : null}

      {magicLinkOnly ? null : (
        <>
          <p className={styles.rule}>or</p>
          <button
            type="button"
            className={styles.secondary}
            disabled={setup || pending !== null}
            onClick={() => void onGoogle()}
          >
            <GoogleMark />
            Continue with Google
          </button>
        </>
      )}

      {localDev && !setup && localDevAction && localDevEmail ? (
        <div className={styles.local}>
          <form action={localDevAction} method="post">
            <button type="submit" className={styles.ghost}>
              Skip login on this machine
            </button>
          </form>
          <p>Signs you in as {localDevEmail}. Hidden in production.</p>
        </div>
      ) : null}
    </div>
  );
}
