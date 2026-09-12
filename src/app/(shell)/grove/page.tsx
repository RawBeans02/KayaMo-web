import { BotanicalGrove } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function Page() {
  const userId = await requireShellUserId();
  return <BotanicalGrove userId={userId} />;
}
