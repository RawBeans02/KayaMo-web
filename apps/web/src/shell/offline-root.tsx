'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { configureApiClient } from '@kayamo/features';
import { startSync } from '@kayamo/offline';
import { type ReactNode, useEffect } from 'react';

export function OfflineRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    const client = createBrowserSupabaseClient();
    configureApiClient({
      getAccessToken: async () => {
        const { data } = await client.auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
    const stopSync = startSync({ getClient: () => client });
    return () => {
      stopSync();
    };
  }, []);

  return children;
}
