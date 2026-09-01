'use client';

import type { MusEntryModule } from '@kayamo/ai';
import { useEffect } from 'react';
import { publishMusSelection } from '../mus/mus-selection';

/** Publishes the current screen selection into the shared Mus rail. Not a second assistant. */
export function DeskMusPane({
  module,
  view,
  selectedIds,
  selectionLabel,
}: {
  userId: string;
  logicalDate: string;
  module: MusEntryModule;
  view?: string | null;
  selectedIds?: string[];
  selectionLabel?: string;
}) {
  const ids = selectedIds ?? [];
  const label = selectionLabel ?? '';
  useEffect(() => {
    publishMusSelection({
      module,
      view: view ?? null,
      selectedIds: ids,
      label,
    });
    return () => publishMusSelection(null);
  }, [ids, label, module, view]);
  return null;
}
