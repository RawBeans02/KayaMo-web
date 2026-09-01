import { z } from 'zod';
import { TASK_ORIGINS } from './schema/constants';

/** Keep these bounds in lockstep with Postgres CHECKs on public.tasks / public.routines. */
export const TASK_TITLE_MAX = 160;
export const ROUTINE_TITLE_MAX = 120;

export const taskTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(TASK_TITLE_MAX);

export const routineTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(ROUTINE_TITLE_MAX);

export const logicalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const taskOriginSchema = z.enum(TASK_ORIGINS);

export const scheduleDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b))
  .refine((days) => days.length >= 1, 'schedule_days must be a non-empty subset of 0–6');

export const localTaskCreateSchema = z
  .object({
    title: taskTitleSchema,
    notes: z.string().max(8000).nullable().optional(),
    scheduledFor: logicalDateSchema.nullable().optional(),
    dueAt: z.string().max(64).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    origin: taskOriginSchema.optional(),
  })
  .strict();

export const localRoutineCreateSchema = z
  .object({
    title: routineTitleSchema,
    notes: z.string().max(8000).nullable().optional(),
    scheduleDays: scheduleDaysSchema,
    preferredTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
      .nullable()
      .optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();

export function parseTaskTitle(title: string): string {
  return taskTitleSchema.parse(title);
}

export function parseRoutineTitle(title: string): string {
  return routineTitleSchema.parse(title);
}

export function parseScheduleDays(days: number[] | undefined): number[] {
  return scheduleDaysSchema.parse(days ?? []);
}
