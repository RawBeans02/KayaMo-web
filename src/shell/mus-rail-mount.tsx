'use client';

import { MusRail } from '@kayamo/features/desktop';

export function MusRailMount({
  userId,
  pathname,
  collapsed,
  onToggle,
}: {
  userId: string;
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <MusRail
      userId={userId}
      pathname={pathname}
      collapsed={collapsed}
      onToggle={onToggle}
      variant="shell"
    />
  );
}
