import { TodayTable } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function CaloriesPage() {
  const userId = await requireShellUserId();
  return <TodayTable userId={userId} />;
}
