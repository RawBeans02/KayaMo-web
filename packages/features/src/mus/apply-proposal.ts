import type { CocoActionProposal } from '@kayamo/ai';
import { mealSlotAtHour } from '@kayamo/food/quick-log';
import {
  persistableFoodId,
  resolveFromCatalogFoods,
} from '@kayamo/food/search-ui';
import {
  addGymSessionItem,
  attachGymDraftToWorkout,
  createLocalAgentMemory,
  createLocalGoal,
  createLocalRoutine,
  createLocalTask,
  createLocalTimeBlock,
  getCachedServings,
  getGymPlannedSet,
  getGymSessionItem,
  getLocalGymPrefs,
  getLocalTask,
  getLocalTaskMeta,
  getLocalTimeBlock,
  gymDraftSessionId,
  listLocalWorkoutHistory,
  localHourFromInstant,
  logFoodEntry,
  recordMusAction,
  setLocalTaskCompleted,
  setLocalTaskScheduledFor,
  spawnRecurrenceIfNeeded,
  startLocalWorkout,
  substituteGymSessionItem,
  taskIsBlocked,
  tombstoneGymSessionItem,
  tombstoneLocalTask,
  updateGymPlannedSet,
  updateLocalTask,
  updateLocalTimeBlock,
  upsertLocalTaskMeta,
} from '@kayamo/offline';
import { exerciseBySlug } from '../gym/library';
import { labelToMinutes } from '../todo/timetable';
import {
  catalogForCommandLog,
  PREFILL_LOG_EVENT,
  servingIdForLabel,
  toLogInputFromCandidate,
} from '../food/command-log-model';
import { catalogFromCache, hydrateVisibleCatalog } from '../food/hydrate-catalog';

export type ApplyProposalResult = {
  ok: boolean;
  message: string;
};

export async function musMayEdit(taskId: string): Promise<boolean> {
  const meta = await getLocalTaskMeta(taskId);
  if (!meta) return true;
  if (meta.ai_access === 'READ' || meta.locked) return false;
  return true;
}

export function prefillLogQuery(query: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PREFILL_LOG_EVENT, { detail: { query } }));
}

async function activeOrDraftSessionId(userId: string): Promise<string> {
  const history = await listLocalWorkoutHistory(userId);
  return history.find((row) => row.status === 'active')?.id ?? gymDraftSessionId(userId);
}

export async function applyMusProposal(params: {
  userId: string;
  proposal: CocoActionProposal;
  timeZone: string;
  dayStartsAt: string;
  today: string;
}): Promise<ApplyProposalResult> {
  const { userId, proposal, timeZone, dayStartsAt, today } = params;
  switch (proposal.action) {
    case 'create_task': {
      await createLocalTask({
        userId,
        title: proposal.arguments.title,
        notes: proposal.arguments.notes,
        scheduledFor: proposal.arguments.scheduledFor ?? today,
        dueAt: proposal.arguments.dueAt,
        origin: 'coco_confirmed',
      });
      return { ok: true, message: `Added “${proposal.arguments.title}” to Todos.` };
    }
    case 'complete_task': {
      if (await taskIsBlocked(userId, proposal.arguments.taskId)) {
        return { ok: false, message: 'Something else has to finish first.' };
      }
      const row = await setLocalTaskCompleted({
        id: proposal.arguments.taskId,
        userId,
        completed: true,
        timeZone,
        dayStartsAt,
      });
      if (!row) return { ok: false, message: 'That task is not on this device.' };
      await spawnRecurrenceIfNeeded({ userId, task: row, today });
      await recordMusAction({
        userId,
        action: 'complete_task',
        summary: `Marked “${row.title}” done`,
        inverse: { kind: 'uncomplete_task', taskId: row.id },
      });
      return { ok: true, message: `Marked “${row.title}” done.` };
    }
    case 'edit_task': {
      if (!(await musMayEdit(proposal.arguments.taskId))) {
        return { ok: false, message: 'That task is locked from Lis edits.' };
      }
      const row = await updateLocalTask({
        id: proposal.arguments.taskId,
        userId,
        title: proposal.arguments.title ?? undefined,
        notes: proposal.arguments.notes,
      });
      if (!row) return { ok: false, message: 'That task is not on this device.' };
      return { ok: true, message: `Updated “${row.title}”.` };
    }
    case 'delete_task': {
      if (!(await musMayEdit(proposal.arguments.taskId))) {
        return { ok: false, message: 'That task is locked from Lis edits.' };
      }
      await tombstoneLocalTask({ id: proposal.arguments.taskId, userId });
      return { ok: true, message: 'Removed that task.' };
    }
    case 'schedule_task': {
      if (!(await musMayEdit(proposal.arguments.taskId))) {
        return { ok: false, message: 'That task is locked from Lis edits.' };
      }
      const existing = await getLocalTask(proposal.arguments.taskId, userId);
      if (!existing) return { ok: false, message: 'That task is not on this device.' };
      const scheduledFor = proposal.arguments.scheduledFor;
      await setLocalTaskScheduledFor({
        id: proposal.arguments.taskId,
        userId,
        scheduledFor,
      });
      const start = proposal.arguments.start ? labelToMinutes(proposal.arguments.start) : null;
      const meta = await getLocalTaskMeta(proposal.arguments.taskId);
      const duration = proposal.arguments.durationMin ?? meta?.estimated_duration_min ?? 30;
      if (start !== null && scheduledFor && meta?.flexibility !== 'ANYTIME') {
        await createLocalTimeBlock({
          userId,
          logicalDate: scheduledFor,
          title: existing.title,
          startMin: start,
          endMin: start + duration,
          sourceTable: 'tasks',
          sourceId: proposal.arguments.taskId,
        });
      }
      await recordMusAction({
        userId,
        action: 'schedule_task',
        summary: `Moved “${existing.title}”`,
        inverse: {
          kind: 'restore_task_schedule',
          taskId: existing.id,
          scheduled_for: existing.scheduled_for,
        },
      });
      return { ok: true, message: `Scheduled “${existing.title}”.` };
    }
    case 'create_time_block': {
      const start = labelToMinutes(proposal.arguments.start);
      const end = labelToMinutes(proposal.arguments.end);
      if (start === null || end === null) return { ok: false, message: 'Need a start and end time.' };
      const block = await createLocalTimeBlock({
        userId,
        logicalDate: proposal.arguments.logicalDate,
        title: proposal.arguments.title,
        startMin: start,
        endMin: end,
        flexibility: proposal.arguments.flexibility,
      });
      await recordMusAction({
        userId,
        action: 'create_time_block',
        summary: `Placed “${block.title}”`,
        inverse: { kind: 'restore_block', id: block.id, deleted_at: true },
      });
      return { ok: true, message: `Placed “${proposal.arguments.title}” on the day.` };
    }
    case 'move_time_block': {
      const start = labelToMinutes(proposal.arguments.start);
      const end = labelToMinutes(proposal.arguments.end);
      if (start === null || end === null) return { ok: false, message: 'Need a start and end time.' };
      const before = await getLocalTimeBlock(proposal.arguments.blockId, userId);
      if (!before) return { ok: false, message: 'That block is not on this device.' };
      if (before.locked && before.flexibility === 'FIXED') {
        return { ok: false, message: 'That block is locked. Move it yourself if you want.' };
      }
      const row = await updateLocalTimeBlock({
        id: proposal.arguments.blockId,
        userId,
        start_min: start,
        end_min: end,
      });
      if (!row) return { ok: false, message: 'That block is not on this device.' };
      await recordMusAction({
        userId,
        action: 'move_time_block',
        summary: `Moved “${row.title}”`,
        inverse: {
          kind: 'restore_block',
          id: row.id,
          start_min: before.start_min,
          end_min: before.end_min,
        },
      });
      return { ok: true, message: `Moved “${row.title}”.` };
    }
    case 'start_workout': {
      const workout = await startLocalWorkout({
        userId,
        timeZone,
        dayStartsAt,
        notes: proposal.arguments.notes,
      });
      await attachGymDraftToWorkout({ userId, workoutId: workout.id });
      return { ok: true, message: 'Started a gym session.' };
    }
    case 'bulk_edit_tasks': {
      if (proposal.arguments.scheduledFor === null && proposal.arguments.complete === null) {
        return { ok: false, message: 'Nothing to change on those todos.' };
      }
      let changed = 0;
      let refused = 0;
      for (const taskId of proposal.arguments.taskIds) {
        if (!(await musMayEdit(taskId))) {
          refused += 1;
          continue;
        }
        const existing = await getLocalTask(taskId, userId);
        if (!existing) {
          refused += 1;
          continue;
        }
        if (proposal.arguments.complete === true) {
          if (await taskIsBlocked(userId, taskId)) {
            refused += 1;
            continue;
          }
          await setLocalTaskCompleted({ id: taskId, userId, completed: true });
          await spawnRecurrenceIfNeeded({ userId, task: existing, today });
        }
        if (proposal.arguments.complete === false) {
          await setLocalTaskCompleted({ id: taskId, userId, completed: false });
        }
        if (proposal.arguments.scheduledFor) {
          await setLocalTaskScheduledFor({
            id: taskId,
            userId,
            scheduledFor: proposal.arguments.scheduledFor,
          });
        }
        changed += 1;
      }
      await recordMusAction({
        userId,
        action: 'bulk_edit_tasks',
        summary: `Updated ${changed} todos`,
        inverse: { kind: 'noop' },
      });
      if (changed === 0) {
        return {
          ok: false,
          message:
            refused > 0
              ? 'Those todos are locked or blocked. Change them yourself if you want.'
              : 'Those todos are not on this device.',
        };
      }
      return {
        ok: true,
        message:
          refused > 0
            ? `Updated ${changed} todos. Left ${refused} locked or blocked.`
            : `Updated ${changed} todos.`,
      };
    }
    case 'set_recurrence': {
      if (!(await musMayEdit(proposal.arguments.taskId))) {
        return { ok: false, message: 'That todo is locked. Change recurrence yourself if you want.' };
      }
      const existing = await getLocalTask(proposal.arguments.taskId, userId);
      if (!existing) return { ok: false, message: 'That todo is not on this device.' };
      await upsertLocalTaskMeta({
        taskId: existing.id,
        userId,
        recurrence: proposal.arguments.recurrence,
        recurrence_interval_days: proposal.arguments.intervalDays ?? 1,
      });
      await recordMusAction({
        userId,
        action: 'set_recurrence',
        summary: `Set recurrence on “${existing.title}”`,
        inverse: { kind: 'noop' },
      });
      return { ok: true, message: `Set recurrence on “${existing.title}”.` };
    }
    case 'add_session_exercise': {
      const exercise = exerciseBySlug(proposal.arguments.slug);
      if (!exercise) return { ok: false, message: 'Lis can only add catalog lifts.' };
      const prefs = await getLocalGymPrefs(userId);
      if (prefs.avoid_slugs.includes(exercise.slug)) {
        return { ok: false, message: 'You marked that lift as avoid. Add it yourself if you want it.' };
      }
      const sessionId = await activeOrDraftSessionId(userId);
      await addGymSessionItem({
        userId,
        sessionId,
        slug: exercise.slug,
        exerciseName: exercise.name,
        source: sessionId.startsWith('draft:') ? 'manual' : 'live',
        targetSets: proposal.arguments.targetSets ?? 3,
        targetReps: proposal.arguments.targetReps ?? exercise.defaultRepMin,
      });
      await recordMusAction({
        userId,
        action: 'add_session_exercise',
        summary: `Added ${exercise.name}`,
        inverse: { kind: 'noop' },
      });
      return { ok: true, message: `Added ${exercise.name} to the gym queue.` };
    }
    case 'replace_session_exercise': {
      const item = await getGymSessionItem(proposal.arguments.itemId, userId);
      if (!item) return { ok: false, message: 'That lift is not on this device.' };
      if (item.locked) {
        return { ok: false, message: 'That lift is locked. Swap it yourself if you want.' };
      }
      const exercise = exerciseBySlug(proposal.arguments.slug);
      if (!exercise) return { ok: false, message: 'Lis can only swap to catalog lifts.' };
      const prefs = await getLocalGymPrefs(userId);
      if (prefs.avoid_slugs.includes(exercise.slug)) {
        return { ok: false, message: 'You marked that lift as avoid. Swap it yourself if you want.' };
      }
      await substituteGymSessionItem({
        userId,
        itemId: item.id,
        slug: exercise.slug,
        exerciseName: exercise.name,
      });
      await recordMusAction({
        userId,
        action: 'replace_session_exercise',
        summary: `Replaced ${item.exercise_name} with ${exercise.name}`,
        inverse: { kind: 'noop' },
      });
      return { ok: true, message: `Replaced ${item.exercise_name} with ${exercise.name}.` };
    }
    case 'skip_session_exercise': {
      const item = await getGymSessionItem(proposal.arguments.itemId, userId);
      if (!item) return { ok: false, message: 'That lift is not on this device.' };
      if (item.locked) {
        return { ok: false, message: 'That lift is locked. Skip it yourself if you want.' };
      }
      await tombstoneGymSessionItem({ id: item.id, userId });
      await recordMusAction({
        userId,
        action: 'skip_session_exercise',
        summary: `Skipped ${item.exercise_name}`,
        inverse: { kind: 'noop' },
      });
      return { ok: true, message: `Skipped ${item.exercise_name}.` };
    }
    case 'edit_planned_set': {
      const row = await getGymPlannedSet(proposal.arguments.plannedSetId, userId);
      if (!row) return { ok: false, message: 'That planned set is not on this device.' };
      if (row.performed_set_id) {
        return { ok: false, message: 'That set is already logged. Planned targets stay.' };
      }
      await updateGymPlannedSet({
        id: row.id,
        userId,
        target_reps: proposal.arguments.targetReps ?? undefined,
        target_weight_kg:
          proposal.arguments.targetWeightKg === null
            ? undefined
            : proposal.arguments.targetWeightKg,
        rest_seconds: proposal.arguments.restSeconds ?? undefined,
      });
      await recordMusAction({
        userId,
        action: 'edit_planned_set',
        summary: 'Updated a future set',
        inverse: { kind: 'noop' },
      });
      return { ok: true, message: 'Updated that future set.' };
    }
    case 'schedule_workout': {
      const start = labelToMinutes(proposal.arguments.start);
      if (start === null) return { ok: false, message: 'Need a start time for gym.' };
      const title = proposal.arguments.title?.trim() || 'Gym';
      const block = await createLocalTimeBlock({
        userId,
        logicalDate: proposal.arguments.logicalDate,
        title,
        startMin: start,
        endMin: start + proposal.arguments.durationMin,
        flexibility: 'FLEXIBLE',
        kind: 'TASK',
      });
      await recordMusAction({
        userId,
        action: 'schedule_workout',
        summary: `Placed “${title}”`,
        inverse: { kind: 'restore_block', id: block.id, deleted_at: true },
      });
      return { ok: true, message: `Placed “${title}” on the day.` };
    }
    case 'create_goal': {
      await createLocalGoal({
        userId,
        title: proposal.arguments.title,
        description: proposal.arguments.description,
        kind: proposal.arguments.kind,
        targetDate: proposal.arguments.targetDate,
        origin: 'coco_confirmed',
      });
      return { ok: true, message: `Saved goal “${proposal.arguments.title}”.` };
    }
    case 'create_routine': {
      await createLocalRoutine({
        userId,
        title: proposal.arguments.title,
        notes: proposal.arguments.notes,
        scheduleDays: proposal.arguments.scheduleDays,
        preferredTime: proposal.arguments.preferredTime,
      });
      return { ok: true, message: `Saved habit “${proposal.arguments.title}”.` };
    }
    case 'remember_this': {
      await createLocalAgentMemory({
        userId,
        kind: proposal.arguments.kind,
        content: proposal.arguments.content,
        confirmed: true,
      });
      return { ok: true, message: 'Remembered, with your confirmation.' };
    }
    case 'log_food': {
      const hint = proposal.arguments.inputHint?.trim() ?? '';
      if (!hint) return { ok: false, message: 'Lis did not name a food to log.' };
      let catalog = catalogForCommandLog(await catalogFromCache());
      if (catalog.length === 0) {
        try {
          catalog = catalogForCommandLog(await hydrateVisibleCatalog());
        } catch {
          catalog = [];
        }
      }
      const hits = (await resolveFromCatalogFoods(hint, userId, catalog)).filter(
        (hit) => persistableFoodId(hit.foodId),
      );
      if (hits.length === 1) {
        const candidate = hits[0];
        if (!candidate) return { ok: false, message: 'Could not resolve that food.' };
        const servings = await getCachedServings(candidate.foodId);
        const hour = localHourFromInstant(new Date().toISOString(), timeZone);
        const input = toLogInputFromCandidate({
          userId,
          mealSlot: mealSlotAtHour(hour),
          candidate,
          servingId: servingIdForLabel(servings, candidate.portion.servingLabel),
          timeZone,
          dayStartsAt,
        });
        if (!input) {
          prefillLogQuery(hint);
          return { ok: false, message: 'Confirm that food in search to finish logging.' };
        }
        await logFoodEntry(input);
        return { ok: true, message: `Logged ${candidate.name}.` };
      }
      prefillLogQuery(hint);
      return {
        ok: true,
        message:
          hits.length === 0
            ? `No catalog match for “${hint}”. Search to log it.`
            : `Several matches for “${hint}”. Pick one to log.`,
      };
    }
    case 'start_focus':
      return {
        ok: false,
        message: 'Focus timer stays on the phone for now. The todo is on Todos if you confirmed one.',
      };
    default: {
      const _never: never = proposal;
      return { ok: false, message: `Cannot apply ${_never}` };
    }
  }
}
