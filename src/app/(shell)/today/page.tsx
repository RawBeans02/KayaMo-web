import { BotanicalHome } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function TodayPage() {
  const userId = await requireShellUserId();
  return <BotanicalHome userId={userId} />;
}
