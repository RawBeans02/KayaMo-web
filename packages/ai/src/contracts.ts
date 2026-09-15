import { z } from 'zod';
import { CONTEXT_LIMITS } from './context-limits';
import { musContextPermissionsSchema } from './context-permissions';

export const cocoModeSchema = z.enum([
  'chat',
  'focus',
  'workout',
  'vent',
  'diary',
  'prayer',
]);
export type CocoMode = z.infer<typeof cocoModeSchema>;

export const cocoToneSchema = z.enum(['gentle', 'balanced', 'firm']);
export type CocoTone = z.infer<typeof cocoToneSchema>;

export const cocoCitationSchema = z
  .object({
    recordType: z.enum([
      'task',
      'routine',
      'food_entry',
      'workout',
      'goal',
      'memory',
      'target',
      'expenditure',
      'achievement',
      'scripture',
    ]),
    recordId: z.string().min(1).max(200),
    label: z.string().trim().min(1).max(120),
  })
  .strict();
export type CocoCitation = z.infer<typeof cocoCitationSchema>;

export const cocoActionNameSchema = z.enum([
  'create_task',
  'complete_task',
  'edit_task',
  'delete_task',
  'schedule_task',
  'create_time_block',
  'move_time_block',
  'start_workout',
  'bulk_edit_tasks',
  'set_recurrence',
  'add_session_exercise',
  'replace_session_exercise',
  'skip_session_exercise',
  'edit_planned_set',
  'schedule_workout',
  'create_routine',
  'create_goal',
  'start_focus',
  'log_food',
  'remember_this',
]);

/** Models often put a time in `scheduledFor`; keep YYYY-MM-DD for the field. */
const calendarDateFromModel = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((value, ctx) => {
    const datePart = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1];
    if (!datePart) {
      ctx.addIssue({ code: 'custom', message: 'Expected a calendar date' });
      return z.NEVER;
    }
    return datePart;
  });

const taskProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('create_task'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        title: z.string().trim().min(1).max(160),
        notes: z.string().trim().max(1000).nullable(),
        scheduledFor: z.string().trim().max(64).nullable(),
        dueAt: z.string().trim().max(64).nullable(),
      })
      .strict()
      .transform((args, ctx) => {
        const rawScheduled = args.scheduledFor;
        let scheduledFor: string | null = null;
        let dueAt = args.dueAt;

        if (rawScheduled) {
          const datePart = /^(\d{4}-\d{2}-\d{2})/.exec(rawScheduled)?.[1];
          if (!datePart) {
            ctx.addIssue({
              code: 'custom',
              message: 'Expected a calendar date',
              path: ['scheduledFor'],
            });
            return z.NEVER;
          }
          scheduledFor = datePart;
          if (!dueAt && rawScheduled.includes('T')) {
            const due = z.string().datetime({ offset: true }).safeParse(rawScheduled);
            if (due.success) dueAt = due.data;
          }
        }

        if (dueAt) {
          const due = z.string().datetime({ offset: true }).safeParse(dueAt);
          if (!due.success) {
            ctx.addIssue({
              code: 'custom',
              message: 'Expected an offset datetime',
              path: ['dueAt'],
            });
            return z.NEVER;
          }
          dueAt = due.data;
        }

        return { title: args.title, notes: args.notes, scheduledFor, dueAt };
      }),
  })
  .strict();

const completeTaskProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('complete_task'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z.object({ taskId: z.string().min(1).max(200) }).strict(),
  })
  .strict();

const routineProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('create_routine'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        title: z.string().trim().min(1).max(120),
        notes: z.string().trim().max(1000).nullable(),
        scheduleDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        preferredTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
          .nullable(),
      })
      .strict(),
  })
  .strict();

const goalProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('create_goal'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        title: z.string().trim().min(1).max(180),
        description: z.string().trim().max(2000).nullable(),
        kind: z.enum(['goal', 'campaign', 'chapter']),
        targetDate: calendarDateFromModel.nullable(),
      })
      .strict(),
  })
  .strict();

const focusProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('start_focus'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        taskId: z.string().min(1).max(200).nullable(),
        minutes: z.number().int().min(1).max(180),
      })
      .strict(),
  })
  .strict();

const foodProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('log_food'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({ inputHint: z.string().trim().min(1).max(300).nullable() })
      .strict(),
  })
  .strict();

const memoryProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('remember_this'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        kind: z.enum(['preference', 'goal', 'context', 'faith']),
        content: z.string().trim().min(1).max(2000),
      })
      .strict(),
  })
  .strict();

const hhmmArg = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

const editTaskProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('edit_task'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        taskId: z.string().min(1).max(200),
        title: z.string().trim().min(1).max(160).nullable(),
        notes: z.string().trim().max(1000).nullable(),
      })
      .strict(),
  })
  .strict();

const deleteTaskProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('delete_task'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z.object({ taskId: z.string().min(1).max(200) }).strict(),
  })
  .strict();

const scheduleTaskProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('schedule_task'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        taskId: z.string().min(1).max(200),
        scheduledFor: calendarDateFromModel.nullable(),
        start: hhmmArg,
        durationMin: z.number().int().min(5).max(8 * 60).nullable(),
      })
      .strict(),
  })
  .strict();

const createTimeBlockProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('create_time_block'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        title: z.string().trim().min(1).max(160),
        logicalDate: calendarDateFromModel,
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        flexibility: z.enum(['FIXED', 'FLEXIBLE', 'AUTO', 'ANYTIME', 'PROTECTED']),
      })
      .strict(),
  })
  .strict();

const moveTimeBlockProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('move_time_block'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        blockId: z.string().min(1).max(200),
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      })
      .strict(),
  })
  .strict();

const startWorkoutProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('start_workout'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z.object({ notes: z.string().trim().max(300).nullable() }).strict(),
  })
  .strict();

const bulkEditTasksProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('bulk_edit_tasks'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        taskIds: z.array(z.string().min(1).max(200)).min(1).max(20),
        scheduledFor: calendarDateFromModel.nullable(),
        complete: z.boolean().nullable(),
      })
      .strict(),
  })
  .strict();

const setRecurrenceProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('set_recurrence'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        taskId: z.string().min(1).max(200),
        recurrence: z.enum(['none', 'daily', 'weekdays', 'weekly', 'monthly', 'after_completion']),
        intervalDays: z.number().int().min(1).max(30).nullable(),
      })
      .strict(),
  })
  .strict();

const addSessionExerciseProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('add_session_exercise'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        slug: z.string().trim().min(1).max(80),
        targetSets: z.number().int().min(1).max(8).nullable(),
        targetReps: z.number().int().min(1).max(30).nullable(),
      })
      .strict(),
  })
  .strict();

const replaceSessionExerciseProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('replace_session_exercise'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        itemId: z.string().min(1).max(200),
        slug: z.string().trim().min(1).max(80),
      })
      .strict(),
  })
  .strict();

const skipSessionExerciseProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('skip_session_exercise'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z.object({ itemId: z.string().min(1).max(200) }).strict(),
  })
  .strict();

const editPlannedSetProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('edit_planned_set'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        plannedSetId: z.string().min(1).max(200),
        targetReps: z.number().int().min(1).max(30).nullable(),
        targetWeightKg: z.number().min(0).max(500).nullable(),
        restSeconds: z.number().int().min(0).max(600).nullable(),
      })
      .strict(),
  })
  .strict();

const scheduleWorkoutProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('schedule_workout'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        logicalDate: calendarDateFromModel,
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        durationMin: z.number().int().min(15).max(240),
        title: z.string().trim().min(1).max(160).nullable(),
      })
      .strict(),
  })
  .strict();

export const cocoActionProposalSchema = z.discriminatedUnion('action', [
  taskProposalSchema,
  completeTaskProposalSchema,
  editTaskProposalSchema,
  deleteTaskProposalSchema,
  scheduleTaskProposalSchema,
  createTimeBlockProposalSchema,
  moveTimeBlockProposalSchema,
  startWorkoutProposalSchema,
  bulkEditTasksProposalSchema,
  setRecurrenceProposalSchema,
  addSessionExerciseProposalSchema,
  replaceSessionExerciseProposalSchema,
  skipSessionExerciseProposalSchema,
  editPlannedSetProposalSchema,
  scheduleWorkoutProposalSchema,
  routineProposalSchema,
  goalProposalSchema,
  focusProposalSchema,
  foodProposalSchema,
  memoryProposalSchema,
]);
export type CocoActionProposal = z.infer<typeof cocoActionProposalSchema>;
export type CocoActionName = CocoActionProposal['action'];

export const cocoSafetyResultSchema = z
  .object({
    level: z.enum(['safe', 'supportive_redirect', 'urgent']),
    category: z.enum([
      'none',
      'self_harm',
      'eating_disorder',
      'medical_emergency',
      'abuse',
    ]),
    allowModel: z.boolean(),
    showEmergencyPrompt: z.boolean(),
    message: z.string().trim().min(1).max(800).nullable(),
  })
  .strict();
export type CocoSafetyResult = z.infer<typeof cocoSafetyResultSchema>;

export const musEntryModuleSchema = z.enum([
  'mus',
  'todos',
  'gym',
  'calories',
  'foods',
  'dashboard',
  'verify',
]);
export type MusEntryModule = z.infer<typeof musEntryModuleSchema>;

export const musEntrySchema = z
  .object({
    module: musEntryModuleSchema,
    view: z.string().trim().max(80).nullable(),
    selectedIds: z.array(z.string().min(1).max(200)).max(20),
  })
  .strict();
export type MusEntry = z.infer<typeof musEntrySchema>;

export const cocoContextSnapshotSchema = z
  .object({
    version: z.literal(1),
    logicalDate: z.string().date(),
    timezone: z.string().min(1).max(100),
    entry: musEntrySchema.optional(),
    recommendedAction: z
      .object({
        kind: z.enum(['task', 'routine', 'food', 'check_in']),
        recordId: z.string().max(200).nullable(),
        title: z.string().trim().min(1).max(180),
      })
      .strict(),
    tasks: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            title: z.string().trim().min(1).max(160),
            completed: z.boolean(),
            dueAt: z.string().datetime({ offset: true }).nullable(),
          })
          .strict(),
      )
      .max(CONTEXT_LIMITS.tasks),
    routines: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            title: z.string().trim().min(1).max(120),
            completed: z.boolean(),
          })
          .strict(),
      )
      .max(CONTEXT_LIMITS.routines),
    health: z
      .object({
        mealsLogged: z.number().int().nonnegative(),
        weightLogged: z.boolean(),
        workoutStatus: z.enum(['none', 'planned', 'active', 'completed']),
        confirmedWorkouts: z
          .array(
            z
              .object({
                id: z.string().min(1).max(200),
                status: z.enum(['active', 'completed', 'abandoned']),
                startedAt: z.string().datetime({ offset: true }),
                endedAt: z.string().datetime({ offset: true }).nullable(),
                setsCompleted: z.number().int().nonnegative(),
                exerciseNames: z.array(z.string().trim().min(1).max(160)).max(30),
                bestE1rmKg: z.number().nonnegative().nullable(),
                isDeload: z.boolean(),
              })
              .strict(),
          )
          .max(CONTEXT_LIMITS.confirmedWorkouts)
          .optional(),
        nutritionGuidance: z
          .object({
            targetId: z.string().min(1).max(200),
            expenditureId: z.string().min(1).max(200),
            targetKcal: z.number().nonnegative(),
            targetProteinG: z.number().nonnegative(),
            loggedKcal: z.number().nonnegative(),
            loggedProteinG: z.number().nonnegative(),
            source: z.literal('target_engine'),
            confidence: z.number().min(0).max(1),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict(),
    goals: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            title: z.string().trim().min(1).max(180),
            status: z.enum(['active', 'completed', 'paused']),
            kind: z.enum(['goal', 'campaign', 'chapter']).optional(),
          })
          .strict(),
      )
      .max(CONTEXT_LIMITS.goals),
    companion: z
      .object({
        totalPoints: z.number().int().nonnegative(),
        stageKey: z.enum(['seed', 'sprout', 'sapling', 'young_tree', 'flourishing_tree']),
        achievements: z
          .array(
            z
              .object({
                id: z.string().min(1).max(200),
                title: z.string().trim().min(1).max(160),
                sourceEventId: z.string().min(1).max(200),
              })
              .strict(),
          )
          .max(20),
      })
      .strict()
      .optional(),
    scripture: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            reference: z.string().trim().min(1).max(100),
            text: z.string().trim().min(1).max(1200),
            translation: z.literal('engwebp'),
            sourceUrl: z.string().url(),
            tags: z.array(z.string().min(1).max(50)).max(20),
          })
          .strict(),
      )
      .max(10)
      .optional(),
    memories: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            kind: z.string().min(1).max(60),
            content: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .max(CONTEXT_LIMITS.memories),
    permissions: musContextPermissionsSchema,
  })
  .strict();
export type CocoContextSnapshot = z.infer<typeof cocoContextSnapshotSchema>;

export const cocoModelOutputSchema = z
  .object({
    message: z.string().trim().min(1).max(1200),
    tone: cocoToneSchema,
    proposals: z.array(cocoActionProposalSchema).max(3),
    citations: z.array(cocoCitationSchema).max(8),
  })
  .strict();
export type CocoModelOutput = z.infer<typeof cocoModelOutputSchema>;

export const cocoResponseSchema = cocoModelOutputSchema
  .extend({ safety: cocoSafetyResultSchema })
  .strict();
export type CocoResponse = z.infer<typeof cocoResponseSchema>;

/**
 * A prior turn in this conversation.
 *
 * History is a UX INPUT, NEVER AN AUTHORITY. The client sends it, so a client
 * could forge an assistant turn — but it could forge one through the sync path
 * too, so reading it server-side would buy nothing. Enforcement stays where it
 * already lives: the system prompt outranks history, `generateObject`
 * constrains the shape, and `authorizeOutput`, the nutrition guard and
 * `evaluateCocoSafety` are all deterministic and run regardless.
 *
 * Safety deliberately still evaluates only the newest user message.
 */
export const cocoHistoryTurnSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(CONTEXT_LIMITS.historyTurnCharsAccepted),
  })
  .strict();
export type CocoHistoryTurn = z.infer<typeof cocoHistoryTurnSchema>;

export const cocoRequestSchema = z
  .object({
    requestId: z.string().min(1).max(100),
    userId: z.string().min(1).max(200),
    mode: cocoModeSchema,
    message: z.string().max(5000),
    context: cocoContextSnapshotSchema,
    allowedActions: z.array(cocoActionNameSchema),
    history: z.array(cocoHistoryTurnSchema).max(CONTEXT_LIMITS.historyTurnsAccepted).optional(),
  })
  .strict();

export type CocoRequest = Omit<z.infer<typeof cocoRequestSchema>, 'allowedActions'> & {
  allowedActions: CocoActionName[];
};

export const cocoToolCallSchema = z
  .object({
    callId: z.string().min(1).max(100),
    name: z.enum(['read_daily_context', 'read_memory', 'propose_action']),
    arguments: z.record(z.string(), z.unknown()),
  })
  .strict();
export type CocoToolCall = z.infer<typeof cocoToolCallSchema>;

export const cocoToolResultSchema = z
  .object({
    callId: z.string().min(1).max(100),
    status: z.enum(['ok', 'denied', 'error']),
    content: z.record(z.string(), z.unknown()),
  })
  .strict();
export type CocoToolResult = z.infer<typeof cocoToolResultSchema>;

export type CocoMemory = {
  id: string;
  kind: 'preference' | 'goal' | 'context' | 'faith';
  content: string;
  explicit: true;
};
