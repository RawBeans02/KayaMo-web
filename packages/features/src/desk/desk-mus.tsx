'use client';

import type { MusEntryModule } from '@kayamo/ai';
import { MusThread } from '../screens/mus-thread';
import styles from '../food/desk.module.css';

export function DeskMusPane({
  userId,
  logicalDate,
  module,
  view,
  selectedIds,
}: {
  userId: string;
  logicalDate: string;
  module: MusEntryModule;
  view?: string | null;
  selectedIds?: string[];
}) {
  return (
    <aside className={styles.dashMus} aria-label="Mus">
      <MusThread
        userId={userId}
        logicalDate={logicalDate}
        recommended={null}
        compact
        entry={{
          module,
          view: view ?? null,
          selectedIds: selectedIds ?? [],
        }}
      />
    </aside>
  );
}
