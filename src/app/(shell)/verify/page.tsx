import { VerifyTable } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';
import { RouteTransition } from '@/shell/route-transition';

export default async function VerifyPage() {
  const userId = await requireShellUserId();
  return (
    <RouteTransition>
      <VerifyTable userId={userId} />
    </RouteTransition>
  );
}
