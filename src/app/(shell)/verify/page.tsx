import { VerifyTable } from '@kayamo/features/desktop';
import { requireShellUserId } from '@/lib/shell-user';

export default async function VerifyPage() {
  const userId = await requireShellUserId();
  return <VerifyTable userId={userId} />;
}
