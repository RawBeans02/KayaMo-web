import { BotanicalGoals } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function Page() {
  const userId = await requireShellUserId();
  return <BotanicalGoals userId={userId} />;
}
