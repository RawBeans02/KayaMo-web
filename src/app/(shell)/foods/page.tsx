import { FoodsTable } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';
import { isGuestId } from '@/lib/guest';
import { WorldwideFoodSearch } from '@kayamo/features/worldwide-food-search';

export default async function FoodsPage() {
  const userId = await requireShellUserId();
  return <FoodsTable userId={userId}>
    <WorldwideFoodSearch userId={userId} guest={isGuestId(userId)} />
  </FoodsTable>;
}
