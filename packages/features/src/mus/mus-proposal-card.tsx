'use client';

import type { CocoActionName, CocoActionProposal } from '@kayamo/ai';
import { ProposalCard } from '@kayamo/ui';
import { useEffect, useState } from 'react';
import { previewMusProposal } from './proposal-preview';

const HIGH_RISK: ReadonlySet<CocoActionName> = new Set(['create_goal']);
const LOW_RISK: ReadonlySet<CocoActionName> = new Set(['remember_this']);

function riskFor(action: CocoActionName): 'low' | 'medium' | 'high' {
  if (HIGH_RISK.has(action)) return 'high';
  if (LOW_RISK.has(action)) return 'low';
  return 'medium';
}

function touchesFor(action: CocoActionName): string[] {
  if (action === 'log_food') return ['Today'];
  if (
    action === 'start_workout' ||
    action === 'add_session_exercise' ||
    action === 'replace_session_exercise' ||
    action === 'skip_session_exercise' ||
    action === 'edit_planned_set' ||
    action === 'schedule_workout'
  ) {
    return ['Gym'];
  }
  if (action === 'create_goal') return ['Goals', 'Todos'];
  if (action === 'remember_this') return ['Mus'];
  return ['Todos'];
}

export function MusProposalCard({
  proposal,
  userId,
  onConfirm,
  onDismiss,
}: {
  proposal: CocoActionProposal;
  userId: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const [diff, setDiff] = useState<{ before: string; after: string } | undefined>();
  useEffect(() => {
    void previewMusProposal(userId, proposal).then((next) => {
      if (!next.before && !next.after) {
        setDiff(undefined);
        return;
      }
      setDiff({
        before: next.before ?? '—',
        after: next.after ?? '—',
      });
    });
  }, [proposal, userId]);

  return (
    <ProposalCard
      risk={riskFor(proposal.action)}
      action={proposal.action.replaceAll('_', ' ')}
      title={proposal.summary}
      why="Mus proposes this. Nothing is saved until you confirm."
      touches={touchesFor(proposal.action)}
      foot="Nothing is saved until you confirm."
      diff={diff}
      onApply={onConfirm}
      onEdit={onDismiss}
      onDismiss={onDismiss}
    />
  );
}
