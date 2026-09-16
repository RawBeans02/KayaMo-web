import { MusDesk } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function MusPage() {
  const userId = await requireShellUserId();
  return (
    <MusDesk userId={userId} />
  );
}
