import { Suspense } from 'react';
import { isLocalDevLoginEnabled } from '@kayamo/features/auth';
import { isClerkConfigured } from '@/lib/clerk';
import { LoginView } from '../login/login-view';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create an account | KayaMo',
  description: 'Create a KayaMo account with your email and a password.',
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <Suspense>
      <LoginView localDev={isLocalDevLoginEnabled()} clerk={isClerkConfigured()} mode="sign-up" />
    </Suspense>
  );
}
