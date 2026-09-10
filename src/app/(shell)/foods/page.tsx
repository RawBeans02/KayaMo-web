import { FoodsTable } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function FoodsPage() {
  const userId = await requireShellUserId();
  return <FoodsTable userId={userId} />;
}
