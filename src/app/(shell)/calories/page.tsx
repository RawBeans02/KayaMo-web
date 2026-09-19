import { TodayTable } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';
import { RouteTransition } from '@/shell/route-transition';

export default async function CaloriesPage() {
  const userId = await requireShellUserId();
  return (
    <RouteTransition>
      <TodayTable userId={userId} />
    </RouteTransition>
  );
}
