import { z } from 'zod';

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:MM')
  .nullable();

export const flexibilityIdSchema = z.enum([
  'FIXED',
  'FLEXIBLE',
  'AUTO',
  'ANYTIME',
  'PROTECTED',
]);

export const horizonIdSchema = z.enum([
  'TODAY',
  'TOMORROW',
  'THIS_WEEK',
  'NEXT_WEEK',
  'LATER',
  'SOMEDAY',
]);

export const proposedBlockSchema = z
  .object({
    kind: z.enum([
      'TASK',
      'EVENT',
      'ROUTINE',
      'HABIT',
      'MEAL_BLOCK',
      'TRAVEL_BLOCK',
      'PROTECTED',
      'TIME_BLOCK',
    ]),
    title: z.string().trim().min(1).max(160),
    start: hhmm,
    end: hhmm,
    flexibility: flexibilityIdSchema,
    sourceTable: z.enum([
      'tasks',
      'events',
      'routines',
      'habits',
      'inbox_items',
      'none',
    ]),
    sourceId: z.string().uuid().nullable(),
    durationMin: z.number().int().min(0).max(24 * 60),
    why: z.string().trim().min(1).max(280),
  })
  .strict();

export const deferralSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    sourceId: z.string().uuid().nullable(),
    toHorizon: horizonIdSchema,
    reason: z.string().trim().min(1).max(280),
  })
  .strict();

export const dayPlanProposalSchema = z
  .object({
    logicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mode: z.enum(['standard', 'minimum', 'rescue', 'restructure']),
    overload: z.boolean(),
    usableOpenMinutes: z.number().int().min(0).max(24 * 60),
    summary: z.string().trim().min(1).max(500),
    blocks: z.array(proposedBlockSchema).max(48),
    deferrals: z.array(deferralSchema).max(24),
    questions: z.array(z.string().trim().min(1).max(200)).max(5),
  })
  .strict();

export const nowOptionSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    durationMin: z.number().int().min(1).max(240),
    why: z.string().trim().min(1).max(200),
    sourceId: z.string().uuid().nullable(),
  })
  .strict();

export const whatNowSchema = z
  .object({
    availableMinutes: z.number().int().min(1).max(240),
    location: z.string().trim().min(1).max(40),
    energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
    options: z.array(nowOptionSchema).min(1).max(5),
  })
  .strict();

export const captureItemSchema = z
  .object({
    kind: z.enum(['TASK', 'EVENT', 'ROUTINE', 'HABIT', 'INBOX', 'PROJECT']),
    title: z.string().trim().min(1).max(160),
    dueHint: z.string().trim().max(80).nullable(),
    preferredWindow: z
      .enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'ANY'])
      .nullable(),
    durationMin: z.number().int().min(0).max(24 * 60).nullable(),
    location: z.string().trim().max(40).nullable(),
    category: z.string().trim().max(40).nullable(),
    constraint: z.string().trim().max(160).nullable(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const captureProposalSchema = z
  .object({
    items: z.array(captureItemSchema).min(1).max(20),
    questions: z.array(z.string().trim().min(1).max(200)).max(5),
  })
  .strict();

export const planDayRequestSchema = z
  .object({
    logicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mode: z.enum(['standard', 'minimum', 'rescue', 'restructure']),
    nowMin: z.number().int().min(0).max(24 * 60),
    energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
    location: z.string().trim().max(40).nullable(),
    weatherNote: z.string().trim().max(80).nullable().optional(),
    note: z.string().trim().max(280).nullable(),
    tasks: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            title: z.string().trim().min(1).max(160),
            scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
            dueAt: z.string().max(64).nullable(),
            durationMin: z.number().int().min(5).max(8 * 60),
            flexibility: flexibilityIdSchema,
            locked: z.boolean(),
            blocked: z.boolean(),
            energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
            location: z.string().trim().max(40).nullable(),
          })
          .strict(),
      )
      .max(80),
    blocks: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            title: z.string().trim().min(1).max(160),
            startMin: z.number().int().min(0).max(24 * 60),
            endMin: z.number().int().min(0).max(24 * 60),
            flexibility: flexibilityIdSchema,
            locked: z.boolean(),
            kind: z.string().trim().min(1).max(40),
          })
          .strict(),
      )
      .max(48),
    windows: z
      .array(
        z
          .object({
            startMin: z.number().int().min(0).max(24 * 60),
            endMin: z.number().int().min(0).max(24 * 60),
          })
          .strict(),
      )
      .max(24),
    gym: z
      .object({
        status: z.enum(['none', 'active', 'completed']),
        typicalDurationMin: z.number().int().min(0).max(240).nullable(),
      })
      .strict()
      .nullable(),
    mealsLogged: z.number().int().min(0).max(20).nullable(),
  })
  .strict();

export const whatNowRequestSchema = z
  .object({
    logicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    availableMinutes: z.number().int().min(1).max(240),
    location: z.string().trim().min(1).max(40),
    energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
    tasks: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            title: z.string().trim().min(1).max(160),
            durationMin: z.number().int().min(5).max(240),
            energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
            location: z.string().trim().max(40).nullable(),
            blocked: z.boolean(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

export const captureTextRequestSchema = z
  .object({
    logicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    text: z.string().trim().min(1).max(4000),
  })
  .strict();

export const imageObservationSchema = z
  .object({
    kind: z.enum(['food', 'whiteboard', 'receipt', 'other']),
    summary: z.string().trim().min(1).max(500),
    foodHints: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            portionHint: z.string().trim().max(80).nullable(),
          })
          .strict(),
      )
      .max(12),
    captureItems: z.array(captureItemSchema).max(20),
    questions: z.array(z.string().trim().min(1).max(200)).max(5),
  })
  .strict();

export const observeImageRequestSchema = z
  .object({
    logicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    imageBase64: z.string().min(8).max(3_500_000),
    caption: z.string().trim().max(500).nullable(),
    module: z.enum(['mus', 'todos', 'gym', 'calories', 'foods', 'dashboard', 'verify']),
  })
  .strict();

export type DayPlanProposal = z.infer<typeof dayPlanProposalSchema>;
export type WhatNow = z.infer<typeof whatNowSchema>;
export type CaptureProposal = z.infer<typeof captureProposalSchema>;
export type PlanDayRequest = z.infer<typeof planDayRequestSchema>;
export type WhatNowRequest = z.infer<typeof whatNowRequestSchema>;
export type ImageObservation = z.infer<typeof imageObservationSchema>;
