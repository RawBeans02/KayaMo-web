import { TodosDesk } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function TodosPage() {
  const userId = await requireShellUserId();
  return <TodosDesk userId={userId} />;
}
