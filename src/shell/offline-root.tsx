'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { configureApiClient } from '@kayamo/features';
import { startSync } from '@kayamo/offline';
import { type ReactNode, useEffect } from 'react';

let browserClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;

function ensureApiClient(): ReturnType<typeof createBrowserSupabaseClient> {
  if (!browserClient) {
    const client = createBrowserSupabaseClient();
    browserClient = client;
    configureApiClient({
      getAccessToken: async () => {
        const { data } = await client.auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
  }
  return browserClient;
}

export function OfflineRoot({ children }: { children: ReactNode }) {
  if (typeof window !== 'undefined') ensureApiClient();

  useEffect(() => {
    const client = ensureApiClient();
    const stopSync = startSync({ getClient: () => client });
    return () => {
      stopSync();
    };
  }, []);

  return children;
}
