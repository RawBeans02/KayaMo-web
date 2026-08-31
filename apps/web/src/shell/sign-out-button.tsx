'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './shell.module.css';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className={styles.signOut}
      disabled={pending}
      onClick={() => {
        setPending(true);
        void createBrowserSupabaseClient()
          .auth.signOut()
          .then(() => {
            router.replace('/login');
          })
          .finally(() => setPending(false));
      }}
    >
      Sign out
    </button>
  );
}
