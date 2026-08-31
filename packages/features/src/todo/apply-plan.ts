import { addLogicalCalendarDays } from '@kayamo/offline/logical-date';
import {
  createLocalHabit,
  createLocalProject,
  createLocalRoutine,
  createLocalTask,
  createLocalTimeBlock,
  getLocalTask,
  recordMusAction,
  setLocalTaskScheduledFor,
  upsertLocalTaskMeta,
  type LocalTask,
  type LocalTimeBlock,
  type ScheduleKind,
} from '@kayamo/offline';
import { firstFit, labelToMinutes, openWindows } from './timetable';
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

function windowStart(window: NonNullable<CaptureProposal['items'][number]['preferredWindow']>): number {
  if (window === 'MORNING') return 9 * 60;
  if (window === 'AFTERNOON') return 13 * 60;
  if (window === 'EVENING') return 18 * 60;
  if (window === 'NIGHT') return 20 * 60;
  return 12 * 60;
}

export async function applyDayPlan(params: {
  userId: string;
  today: string;
  plan: DayPlanProposal;
}): Promise<{ ok: boolean; message: string }> {
  const createdIds: string[] = [];
  const previousSchedules: { taskId: string; scheduled_for: string | null }[] = [];
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
    });
  }
  await recordMusAction({
    userId: params.userId,
    action: 'plan_my_day',
    summary: params.plan.summary.slice(0, 180),
    inverse: { kind: 'undo_plan', blockIds: createdIds, tasks: previousSchedules },
  });
  return { ok: true, message: params.plan.summary };
}

export async function applyWhatNowPick(params: {
  userId: string;
  today: string;
  option: WhatNow['options'][number];
  blocks: LocalTimeBlock[];
}): Promise<{ ok: boolean; message: string }> {
  const slot = firstFit(openWindows(params.blocks), params.option.durationMin);
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

export async function applyCaptureItems(params: {
  userId: string;
  today: string;
  capture: CaptureProposal;
}): Promise<{ ok: boolean; message: string }> {
  let count = 0;
  for (const item of params.capture.items) {
    if (item.kind === 'TASK' || item.kind === 'INBOX') {
      const task: LocalTask = await createLocalTask({
        userId: params.userId,
        title: item.title,
        scheduledFor: item.kind === 'INBOX' ? null : params.today,
        origin: 'coco_confirmed',
      });
      await upsertLocalTaskMeta({
        taskId: task.id,
        userId: params.userId,
        estimated_duration_min: item.durationMin ?? 30,
        location: item.location,
      });
      count += 1;
      continue;
    }
    if (item.kind === 'PROJECT') {
      await createLocalProject({ userId: params.userId, title: item.title });
      count += 1;
      continue;
    }
    if (item.kind === 'ROUTINE') {
      await createLocalRoutine({
        userId: params.userId,
        title: item.title,
        notes: item.constraint,
        scheduleDays: [1, 2, 3, 4, 5],
        preferredTime: null,
      });
      count += 1;
      continue;
    }
    if (item.kind === 'HABIT') {
      await createLocalHabit({ userId: params.userId, title: item.title });
      count += 1;
      continue;
    }
    if (item.kind === 'EVENT') {
      const start = item.preferredWindow ? windowStart(item.preferredWindow) : 12 * 60;
      const duration = item.durationMin && item.durationMin > 0 ? item.durationMin : 60;
      await createLocalTimeBlock({
        userId: params.userId,
        logicalDate: params.today,
        title: item.title,
        kind: 'EVENT',
        startMin: start,
        endMin: start + duration,
        flexibility: 'FIXED',
      });
      count += 1;
    }
  }
  return {
    ok: true,
    message: count === 1 ? 'Saved that capture.' : `Saved ${count} captured items.`,
  };
}
