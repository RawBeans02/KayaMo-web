import { TodosDesk } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';
import { RouteTransition } from '@/shell/route-transition';

export default async function TodosPage() {
  const userId = await requireShellUserId();
  return (
    <RouteTransition>
      <TodosDesk userId={userId} />
    </RouteTransition>
  );
}
