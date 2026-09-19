'use client';

import { useClerk } from '@clerk/nextjs';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './shell.module.css';

/**
 * Both sessions end. Supabase's goes first, then Clerk ends its own and
 * performs a full page load to the login: a soft navigation would run while
 * Clerk's cookies are still being cleared, and the gate would bridge the
 * lingering Clerk session straight back in.
 */
export function SignOutButton({ clerk }: { clerk: boolean }) {
  return clerk ? <ClerkSignOut /> : <SupabaseSignOut after={null} />;
}

function ClerkSignOut() {
  const { signOut } = useClerk();
  return <SupabaseSignOut after={() => signOut({ redirectUrl: '/login' })} />;
}

function SupabaseSignOut({ after }: { after: (() => Promise<unknown>) | null }) {
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
          .then(() => (after ? after() : router.replace('/login')))
          .finally(() => setPending(false));
      }}
    >
      Sign out
    </button>
  );
}
