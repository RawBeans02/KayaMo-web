'use client';

import { LoginForm as SharedLoginForm } from '@kayamo/features';

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
}: {
  sent: boolean;
  error: string | null;
  setup: boolean;
}) {
  return (
    <SharedLoginForm
      ports={PORTS}
      sent={sent}
      error={error}
      setup={setup}
      localDev={false}
      magicLinkOnly
    />
  );
}
