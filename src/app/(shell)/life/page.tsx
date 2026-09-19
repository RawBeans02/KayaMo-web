import { BotanicalLife } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function Page() {
  await requireShellUserId();
  return <BotanicalLife />;
}
