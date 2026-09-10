import { createServerSupabase } from '@/lib/supabase/server';
import { GUEST_COOKIE, isValidGuestId } from '@/lib/guest';
import { DesktopShell } from '@/shell/desktop-shell';
import { OfflineRoot } from '@/shell/offline-root';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <OfflineRoot userId={user.id}>
        <DesktopShell email={user.email ?? 'Signed in'} userId={user.id}>
          {children}
        </DesktopShell>
      </OfflineRoot>
    );
  }

  // No account: run the demo against a local-only guest id. There is no
  // Supabase session here, so sync stays parked and nothing reaches the server.
  const guestId = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!isValidGuestId(guestId)) redirect('/');

  return (
    <OfflineRoot guestId={guestId}>
      <DesktopShell email="Demo" userId={guestId} guest>
        {children}
      </DesktopShell>
    </OfflineRoot>
  );
}
