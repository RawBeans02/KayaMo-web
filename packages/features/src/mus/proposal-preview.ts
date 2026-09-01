import type { CocoActionProposal } from '@kayamo/ai';
import { getLocalTask, getLocalTimeBlock } from '@kayamo/offline';
import { minutesToLabel } from '../todo/timetable';

export type ProposalDiff = {
  actionLabel: string;
  summary: string;
  before: string | null;
  after: string | null;
};

export function actionLabel(action: CocoActionProposal['action']): string {
  return action.replaceAll('_', ' ');
}

function base(proposal: CocoActionProposal): ProposalDiff {
  return {
    actionLabel: actionLabel(proposal.action),
    summary: proposal.summary,
    before: null,
    after: null,
  };
}

export async function previewMusProposal(
  userId: string,
  proposal: CocoActionProposal,
): Promise<ProposalDiff> {
  const diff = base(proposal);
  switch (proposal.action) {
    case 'create_task':
      return {
        ...diff,
        after: proposal.arguments.scheduledFor
          ? `${proposal.arguments.title} · ${proposal.arguments.scheduledFor}`
          : `${proposal.arguments.title} · today`,
      };
    case 'edit_task': {
      const task = await getLocalTask(proposal.arguments.taskId, userId);
      return {
        ...diff,
        before: task?.title ?? 'Unknown task',
        after: proposal.arguments.title ?? proposal.arguments.notes ?? task?.title ?? null,
      };
    }
    case 'delete_task': {
      const task = await getLocalTask(proposal.arguments.taskId, userId);
      return { ...diff, before: task?.title ?? 'Unknown task', after: 'Archived' };
    }
    case 'complete_task': {
      const task = await getLocalTask(proposal.arguments.taskId, userId);
      return {
        ...diff,
        before: task ? `${task.title} · open` : null,
        after: 'Done',
      };
    }
    case 'schedule_task': {
      const task = await getLocalTask(proposal.arguments.taskId, userId);
      const when = proposal.arguments.scheduledFor ?? 'inbox';
      const time = proposal.arguments.start ? ` ${proposal.arguments.start}` : '';
      return {
        ...diff,
        before: task ? `${task.title} · ${task.scheduled_for ?? 'inbox'}` : null,
        after: `${task?.title ?? 'Task'} · ${when}${time}`,
      };
    }
    case 'move_time_block': {
      const block = await getLocalTimeBlock(proposal.arguments.blockId, userId);
      return {
        ...diff,
        before: block
          ? `${block.title} · ${minutesToLabel(block.start_min)}–${minutesToLabel(block.end_min)}`
          : null,
        after: `${block?.title ?? 'Block'} · ${proposal.arguments.start}–${proposal.arguments.end}`,
      };
    }
    case 'create_time_block':
      return {
        ...diff,
        after: `${proposal.arguments.title} · ${proposal.arguments.logicalDate} ${proposal.arguments.start}–${proposal.arguments.end}`,
      };
    case 'create_goal':
      return { ...diff, after: proposal.arguments.title };
    case 'log_food':
      return { ...diff, after: proposal.arguments.inputHint ?? proposal.summary };
    default:
      return diff;
  }
}
