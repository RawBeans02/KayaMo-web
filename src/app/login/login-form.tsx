'use client';

import { LOCAL_DEV_EMAIL, LoginForm as SharedLoginForm } from '@kayamo/features';

const PORTS = {
  afterAuthPath: '/today',
  isNativeApp: () => false,
  nativeCallbackUrl: 'kayamo://auth/callback',
} as const;

/**
 * Auth UI lives in packages/features (LoginForm). PWA and web share it.
 * Web sets magicLinkOnly and never uses the native kayamo:// redirect;
 * that callback URL is a port so this is not a fork of PWA auth.
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
    />
  );
}
