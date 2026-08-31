import { createServerSupabase } from '@/lib/supabase/server';
import { DesktopShell } from '@/shell/desktop-shell';
import { OfflineRoot } from '@/shell/offline-root';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <OfflineRoot>
      <DesktopShell email={user.email ?? 'Signed in'} userId={user.id}>
        {children}
      </DesktopShell>
    </OfflineRoot>
  );
}
