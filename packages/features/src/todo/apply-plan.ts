import { addLogicalCalendarDays } from '@kayamo/offline/logical-date';
import {
  createLocalHabit,
  createLocalProject,
  createLocalRoutine,
  createLocalTask,
  createLocalTimeBlock,
  drainQueue,
  findUndoneMusActionByProposalId,
  getLocalTask,
  getOfflineDb,
  recordMusAction,
  setLocalTaskScheduledFor,
  upsertLocalTaskMeta,
  type LocalTask,
  type LocalTimeBlock,
  type ScheduleKind,
} from '@kayamo/offline';
import { firstFit, labelToMinutes, openWindowsAfter } from './timetable';
import type {
  CaptureProposal,
  DayPlanProposal,
  WhatNow,
} from './planner-schema';

export function horizonToScheduledFor(
  today: string,
  horizon: 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK' | 'LATER' | 'SOMEDAY',
): string | null {
  if (horizon === 'TODAY') return today;
  if (horizon === 'TOMORROW') return addLogicalCalendarDays(today, 1);
  if (horizon === 'THIS_WEEK') return addLogicalCalendarDays(today, 3);
  if (horizon === 'NEXT_WEEK') return addLogicalCalendarDays(today, 7);
  if (horizon === 'LATER') return addLogicalCalendarDays(today, 14);
  return null;
}

export function planSourceTable(
  sourceTable: DayPlanProposal['blocks'][number]['sourceTable'],
): LocalTimeBlock['source_table'] {
  return sourceTable === 'tasks' ? 'tasks' : 'none';
}

export function planKind(kind: DayPlanProposal['blocks'][number]['kind']): ScheduleKind {
  if (kind === 'EVENT') return 'EVENT';
  if (kind === 'ROUTINE' || kind === 'HABIT') return 'ROUTINE';
  if (kind === 'MEAL_BLOCK') return 'MEAL';
  if (kind === 'TRAVEL_BLOCK') return 'TRAVEL';
  if (kind === 'PROTECTED') return 'PROTECTED';
  return 'TASK';
}

export function dayPlanProposalId(plan: DayPlanProposal): string {
  if (plan.proposalId) return plan.proposalId;
  const fingerprint = [
    plan.logicalDate,
    plan.mode,
    plan.summary,
    plan.blocks.map((block) => `${block.start}|${block.end}|${block.title}|${block.sourceId ?? ''}`).join(';'),
    plan.deferrals.map((row) => `${row.sourceId ?? ''}|${row.toHorizon}`).join(';'),
  ].join('::');
  let hash = 2166136261;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `plan-${(hash >>> 0).toString(16)}`;
}

export async function applyDayPlan(params: {
  userId: string;
  today: string;
  plan: DayPlanProposal;
}): Promise<{ ok: boolean; message: string }> {
  const proposalId = dayPlanProposalId(params.plan);
  const already = await findUndoneMusActionByProposalId(params.userId, proposalId);
  if (already) return { ok: true, message: already.summary };

  const createdIds: string[] = [];
  const previousSchedules: { taskId: string; scheduled_for: string | null }[] = [];
  const db = getOfflineDb();
  await db.transaction('rw', db.time_blocks, db.tasks, db.mus_action_log, db.sync_queue, async () => {
    for (const block of params.plan.blocks) {
      if (block.flexibility === 'ANYTIME' || block.start === null) continue;
      const start = labelToMinutes(block.start);
      const end = block.end ? labelToMinutes(block.end) : start !== null ? start + block.durationMin : null;
      if (start === null || end === null) continue;
      const sourceId = block.sourceTable === 'tasks' ? block.sourceId : null;
      if (sourceId) {
        const task = await getLocalTask(sourceId, params.userId);
        if (task) {
          previousSchedules.push({ taskId: task.id, scheduled_for: task.scheduled_for });
          await setLocalTaskScheduledFor({
            id: task.id,
            userId: params.userId,
            scheduledFor: params.plan.logicalDate,
            drain: false,
          });
        }
      }
      const row = await createLocalTimeBlock({
        userId: params.userId,
        logicalDate: params.plan.logicalDate,
        title: block.title,
        kind: planKind(block.kind),
        startMin: start,
        endMin: end,
        flexibility: block.flexibility,
        sourceTable: planSourceTable(block.sourceTable),
        sourceId,
        notes: block.why,
      });
      createdIds.push(row.id);
    }
    for (const deferral of params.plan.deferrals) {
      if (!deferral.sourceId) continue;
      const task = await getLocalTask(deferral.sourceId, params.userId);
      if (!task) continue;
      previousSchedules.push({ taskId: task.id, scheduled_for: task.scheduled_for });
      await setLocalTaskScheduledFor({
        id: task.id,
        userId: params.userId,
        scheduledFor: horizonToScheduledFor(params.today, deferral.toHorizon),
        drain: false,
      });
    }
    await recordMusAction({
      userId: params.userId,
      action: 'plan_my_day',
      summary: params.plan.summary.slice(0, 180),
      inverse: { kind: 'undo_plan', proposalId, blockIds: createdIds, tasks: previousSchedules },
    });
  });
  void drainQueue();
  return { ok: true, message: params.plan.summary };
}

export async function applyWhatNowPick(params: {
  userId: string;
  today: string;
  option: WhatNow['options'][number];
  blocks: LocalTimeBlock[];
  nowMin: number;
}): Promise<{ ok: boolean; message: string }> {
  const slot = firstFit(openWindowsAfter(params.blocks, params.nowMin), params.option.durationMin);
  if (!slot) return { ok: false, message: 'No open window that long is left today.' };
  if (params.option.sourceId) {
    const task = await getLocalTask(params.option.sourceId, params.userId);
    if (task) {
      await setLocalTaskScheduledFor({
        id: task.id,
        userId: params.userId,
        scheduledFor: params.today,
      });
    }
  }
  await createLocalTimeBlock({
    userId: params.userId,
    logicalDate: params.today,
    title: params.option.title,
    startMin: slot.startMin,
    endMin: slot.endMin,
    sourceTable: params.option.sourceId ? 'tasks' : 'none',
    sourceId: params.option.sourceId,
    notes: params.option.why,
  });
  return { ok: true, message: `Placed “${params.option.title}” in the next open window.` };
}

function captureScheduledFor(
  today: string,
  item: CaptureProposal['items'][number],
): string | null {
  if (item.scheduledFor) return item.scheduledFor;
  if (item.horizon) return horizonToScheduledFor(today, item.horizon);
  return null;
}

function captureIsUncertain(item: CaptureProposal['items'][number]): boolean {
  return item.timing === 'vague' || item.timing === 'unknown';
}

export type CaptureDisposition =
  | { write: 'project' }
  | { write: 'habit' }
  | { write: 'routine'; scheduleDays: number[]; preferredTime: string | null }
  | { write: 'event'; startMin: number; durationMin: number; logicalDate: string }
  | { write: 'task'; scheduledFor: string | null };

export function captureDisposition(
  item: CaptureProposal['items'][number],
  today: string,
): CaptureDisposition {
  if (item.kind === 'PROJECT') return { write: 'project' };
  if (item.kind === 'HABIT') return { write: 'habit' };
  if (item.kind === 'ROUTINE') {
    if (!item.scheduleDays || item.scheduleDays.length === 0) {
      return { write: 'task', scheduledFor: null };
    }
    return {
      write: 'routine',
      scheduleDays: item.scheduleDays,
      preferredTime: item.preferredTime ?? null,
    };
  }
  if (item.kind === 'EVENT') {
    const start = item.preferredTime ? labelToMinutes(item.preferredTime) : null;
    if (start === null || captureIsUncertain(item)) {
      return { write: 'task', scheduledFor: null };
    }
    return {
      write: 'event',
      startMin: start,
      durationMin: item.durationMin && item.durationMin > 0 ? item.durationMin : 60,
      logicalDate: item.scheduledFor ?? today,
    };
  }
  const scheduledFor =
    item.kind === 'INBOX' || captureIsUncertain(item)
      ? null
      : captureScheduledFor(today, item);
  return { write: 'task', scheduledFor };
}

export async function applyCaptureItems(params: {
  userId: string;
  today: string;
  capture: CaptureProposal;
}): Promise<{ ok: boolean; message: string }> {
  let count = 0;
  for (const item of params.capture.items) {
    const disposition = captureDisposition(item, params.today);
    if (disposition.write === 'project') {
      await createLocalProject({ userId: params.userId, title: item.title });
    } else if (disposition.write === 'habit') {
      await createLocalHabit({ userId: params.userId, title: item.title });
    } else if (disposition.write === 'routine') {
      await createLocalRoutine({
        userId: params.userId,
        title: item.title,
        notes: item.constraint,
        scheduleDays: disposition.scheduleDays,
        preferredTime: disposition.preferredTime,
      });
    } else if (disposition.write === 'event') {
      await createLocalTimeBlock({
        userId: params.userId,
        logicalDate: disposition.logicalDate,
        title: item.title,
        kind: 'EVENT',
        startMin: disposition.startMin,
        endMin: disposition.startMin + disposition.durationMin,
        flexibility: 'FIXED',
      });
    } else {
      await createInboxItem(params.userId, item, disposition.scheduledFor);
    }
    count += 1;
  }
  return {
    ok: true,
    message: count === 1 ? 'Saved that capture.' : `Saved ${count} captured items.`,
  };
}

async function createInboxItem(
  userId: string,
  item: CaptureProposal['items'][number],
  scheduledFor: string | null = null,
): Promise<LocalTask> {
  const task = await createLocalTask({
    userId,
    title: item.title,
    scheduledFor,
    dueAt: item.dueAt ?? null,
    origin: 'coco_confirmed',
  });
  await upsertLocalTaskMeta({
    taskId: task.id,
    userId,
    estimated_duration_min: item.durationMin ?? 30,
    location: item.location,
  });
  return task;
}
