'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from './login-form';

function LoginInner() {
  const params = useSearchParams();
  const sent = params.get('sent') === '1';
  const setup = params.get('setup') === '1';
  const error = params.get('error');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo desktop</p>
      <h1 className="font-display mt-2 text-3xl tracking-tight">Log in two seconds. Verify in one pass.</h1>
      <p className="mt-2 max-w-prose text-muted">
        Magic link only for now. After you sign in, ⌘K logs a known food without touching the mouse.
      </p>
      <div className="mt-6">
        <LoginForm sent={sent} setup={setup} error={error} />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
