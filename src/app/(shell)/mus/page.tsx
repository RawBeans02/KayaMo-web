import { MusDesk } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';
import { RouteTransition } from '@/shell/route-transition';

export default async function MusPage() {
  const userId = await requireShellUserId();
  return (
    <RouteTransition>
      <MusDesk userId={userId} />
    </RouteTransition>
  );
}
