import { GymDesk } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function GymPage() {
  const userId = await requireShellUserId();
  return <GymDesk userId={userId} />;
}
