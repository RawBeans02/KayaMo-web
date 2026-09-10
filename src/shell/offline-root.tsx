'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { configureApiClient } from '@kayamo/features';
import { setOfflineUserScope, startSync } from '@kayamo/offline';
import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { seedDemoCatalog } from './demo-seed';

export function OfflineRoot({
  children,
  guestId = null,
  userId = null,
}: {
  children: ReactNode;
  guestId?: string | null;
  userId?: string | null;
}) {
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scope = guestId ?? userId;

  useEffect(() => {
    let cancelled = false;
    let stopSync = () => {};
    configureApiClient({
      getAccessToken: async () => {
        // Fail before fetch: local demo text must never reach a server API.
        if (guestId) throw new Error('Sign in to use online features. Demo data stays on this device.');
        const { data } = await createBrowserSupabaseClient().auth.getSession();
        if (!data.session) throw new Error('Sign in again to use online features.');
        return data.session.access_token;
      },
    });
    void (async () => {
      try {
        if (!scope) throw new Error('Missing account scope');
        await setOfflineUserScope(scope);
        if (cancelled) return;
        if (guestId) {
          await seedDemoCatalog(guestId);
        } else {
          const client = createBrowserSupabaseClient();
          stopSync = startSync({ getClient: () => client });
        }
        if (!cancelled) setReadyScope(scope);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      stopSync();
    };
  }, [attempt, guestId, scope]);

  if (error) return (
    <main style={{ maxWidth: 480, margin: '15vh auto', padding: 24 }}>
      <h1>Couldn’t open your local workspace</h1>
      <p role="alert">Your saved data has not been cleared. Check your connection and allow browser storage, then retry.</p>
      <button onClick={() => { setError(false); setReadyScope(null); setAttempt((value) => value + 1); }}>Retry</button>
      <p><Link href="/">Back to KayaMo</Link></p>
    </main>
  );
  if (!scope || readyScope !== scope) return (
    <main style={{ padding: 48 }}><p role="status">Opening your workspace…</p></main>
  );
  return children;
}
