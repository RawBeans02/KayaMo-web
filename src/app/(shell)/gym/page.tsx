import { GymDesk } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';
import { RouteTransition } from '@/shell/route-transition';

export default async function GymPage() {
  const userId = await requireShellUserId();
  return (
    <RouteTransition>
      <GymDesk userId={userId} />
    </RouteTransition>
  );
}
