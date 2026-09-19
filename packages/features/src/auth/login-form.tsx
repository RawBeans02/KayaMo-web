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

/** The form's own floor; the Supabase project may ask for more. */
export const MIN_PASSWORD_LENGTH = 8;

export function LoginForm({
  ports,
  sent,
  error,
  setup,
  localDev,
  localDevAction,
  localDevEmail,
  magicLinkOnly = false,
  method = 'magic-link',
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
  /**
   * `password`: email and password, with account creation on the same form
   * (owner decision 2026-09-20: no confirmation emails for now, so nothing
   * waits on an inbox). `magic-link`: the emailed link, unchanged.
   */
  method?: 'magic-link' | 'password';
}) {
  const passwordMethod = method === 'password';
  const [pending, setPending] = useState<'email' | 'google' | 'password' | 'signup' | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverErrorDismissed, setServerErrorDismissed] = useState(false);
  const [clientSent, setClientSent] = useState(sent);
  const [sentEmail, setSentEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  // Flipped after mount, so a test (or anything else) can tell that the event
  // handlers below are attached. Server HTML paints the form and the error
  // banner before React hydrates; input typed into that pre-hydration form is
  // lost, which is exactly what a slow engine in CI reproduced.
  const [hydrated, setHydrated] = useState(false);
  const retryAt = useRef(0);
  const cooldownActive = cooldown > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);
  const errorId = useId();

  useEffect(() => {
    setHydrated(true);
  }, []);

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

  function readCredentials(form: HTMLFormElement): { email: string; password: string } | null {
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (!email) {
      setClientError('Email is required');
      return null;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setClientError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return null;
    }
    return { email, password };
  }

  /** Every failure reads the same to the person; the provider's wording never shows. */
  function passwordFailure(status: number | undefined, code: string | undefined, create: boolean) {
    if (status === 429) {
      startCooldown();
      return 'Too many attempts. Please wait a minute before trying again.';
    }
    if (create && code === 'user_already_exists') {
      return 'That email already has an account. Sign in with its password instead.';
    }
    if (create && code === 'weak_password') {
      return `Choose a stronger password of at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (create) return 'We couldn’t create the account. Check the email address and try again.';
    if (status === 400 || code === 'invalid_credentials') return 'Email or password did not match.';
    return 'Could not sign in right now. Try again in a moment.';
  }

  async function withPassword(form: HTMLFormElement, create: boolean) {
    if (requestInFlight.current || cooldown > 0) return;
    const credentials = readCredentials(form);
    if (!credentials) return;
    setPending(create ? 'signup' : 'password');
    setClientError(null);
    setServerErrorDismissed(true);
    requestInFlight.current = true;
    try {
      const supabase = createBrowserSupabase();
      const { data, error: authError } = create
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
      if (authError) {
        setClientError(passwordFailure(authError.status, authError.code, create));
        return;
      }
      if (!data.session) {
        // Only possible when the project asks for email confirmation, which
        // this form does not promise; say what happened instead of hanging.
        setClientError('The account was created but needs confirmation. Contact support to finish signing in.');
        return;
      }
      // A full navigation: the session cookie was just written and the
      // server gate reads it on the next request.
      window.location.assign(ports.afterAuthPath);
      return;
    } catch {
      setClientError('Could not connect. Check your connection and try again.');
    } finally {
      requestInFlight.current = false;
      setPending(null);
    }
  }

  const shownError = clientError ?? (serverErrorDismissed ? null : error);
  const shownSent = passwordMethod ? false : clientSent;

  return (
    <div className={styles.root} data-hydrated={hydrated ? '' : undefined}>
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
        onSubmit={(event) => {
          event.preventDefault();
          if (passwordMethod) void withPassword(event.currentTarget, false);
          else void onEmail(event);
        }}
        className={styles.stack}
        aria-busy={pending !== null && pending !== 'google'}
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
            readOnly={pending !== null && pending !== 'google'}
            onChange={() => {
              setClientSent(false);
              setClientError(null);
              setServerErrorDismissed(true);
            }}
          />
        </label>
        {passwordMethod ? (
          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="current-password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              aria-describedby={shownError ? errorId : undefined}
              readOnly={pending !== null && pending !== 'google'}
              onChange={() => {
                setClientError(null);
                setServerErrorDismissed(true);
              }}
            />
          </label>
        ) : null}
        <button
          type="submit"
          className={styles.primary}
          disabled={setup || pending !== null || cooldown > 0}
        >
          {passwordMethod
            ? pending === 'password'
              ? 'Signing in…'
              : cooldown > 0
                ? `Try again in ${cooldown}s`
                : 'Sign in'
            : pending === 'email'
              ? 'Sending…'
              : cooldown > 0
                ? `Request another link in ${cooldown}s`
                : magicLinkOnly
                  ? shownSent
                    ? 'Resend sign-in link'
                    : 'Email me a sign-in link'
                  : 'Send magic link'}
        </button>
        {passwordMethod ? (
          <button
            type="button"
            className={styles.ghost}
            disabled={setup || pending !== null || cooldown > 0}
            onClick={(event) => void withPassword(event.currentTarget.form!, true)}
          >
            {pending === 'signup' ? 'Creating your account…' : 'New here? Create an account'}
          </button>
        ) : null}
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

      {magicLinkOnly || passwordMethod ? null : (
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
