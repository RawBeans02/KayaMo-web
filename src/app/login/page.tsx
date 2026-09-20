import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { isLocalDevLoginEnabled } from '@kayamo/features/auth';
import { authCallbackPathFromSearch } from '@/lib/auth-landing';
import { isClerkConfigured } from '@/lib/clerk';
import { LoginView } from './login-view';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in | KayaMo',
  description: 'Sign in to KayaMo with your email and password, or explore the local demo.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callback = authCallbackPathFromSearch(params, '/today');
  if (callback) redirect(callback);

  return (
    <Suspense>
      <LoginView localDev={isLocalDevLoginEnabled()} clerk={isClerkConfigured()} />
    </Suspense>
  );
}
