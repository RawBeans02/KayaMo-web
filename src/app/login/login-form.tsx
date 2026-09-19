'use client';

import { LOCAL_DEV_EMAIL } from '@kayamo/features/auth';
import { LoginForm as SharedLoginForm } from '@kayamo/features/login-form';

const PORTS = {
  afterAuthPath: '/today',
  isNativeApp: () => false,
  nativeCallbackUrl: 'kayamo://auth/callback',
} as const;

/**
 * Auth UI lives in packages/features (LoginForm). The web signs in with an
 * email and password (owner decision 2026-09-20, no confirmation emails yet)
 * and never uses the native kayamo:// redirect; that callback URL is a port
 * so this is not a fork of the PWA's auth.
 */
export function LoginForm({
  sent,
  error,
  setup,
  localDev,
}: {
  sent: boolean;
  error: string | null;
  setup: boolean;
  localDev: boolean;
}) {
  return (
    <SharedLoginForm
      ports={PORTS}
      sent={sent}
      error={error}
      setup={setup}
      localDev={localDev}
      localDevAction={localDev ? '/api/auth/local-dev' : undefined}
      localDevEmail={localDev ? LOCAL_DEV_EMAIL : undefined}
      magicLinkOnly
      method="password"
    />
  );
}
