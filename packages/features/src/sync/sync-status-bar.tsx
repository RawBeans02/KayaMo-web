'use client';

import { useSyncStatus } from '@kayamo/offline';

function label(status: ReturnType<typeof useSyncStatus>): string {
  switch (status.kind) {
    case 'offline':
      return 'Offline';
    case 'pending':
      return `Pending ${status.count}`;
    case 'paused':
      return 'Sync paused';
    case 'degraded':
      return `Sync retrying ${status.failedTables}`;
    case 'needs_attention':
      return `Needs attention ${status.count}`;
    case 'local_db_error':
      return 'Local data error';
    case 'synced':
      return 'Synced';
  }
}

export function SyncStatusBar({ className }: { className?: string }) {
  const status = useSyncStatus();
  return (
    <span data-testid="sync-status" data-sync-kind={status.kind} className={className}>
      {label(status)}
    </span>
  );
}
