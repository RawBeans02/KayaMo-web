import { BotanicalGrove } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';
import { RouteTransition } from '@/shell/route-transition';

export default async function Page() {
  const userId = await requireShellUserId();
  return (
    <RouteTransition>
      <BotanicalGrove userId={userId} />
    </RouteTransition>
  );
}
