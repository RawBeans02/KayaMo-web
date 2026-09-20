import { BotanicalHome } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';
import { RouteTransition } from '@/shell/route-transition';

export default async function TodayPage() {
  const userId = await requireShellUserId();
  return (
    <RouteTransition>
      <BotanicalHome userId={userId} />
    </RouteTransition>
  );
}
