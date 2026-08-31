import { z } from 'zod';

export const gymConsultPickSchema = z
  .object({
    slug: z.string().min(1).max(80),
    sets: z.number().int().min(2).max(6),
    reps: z.number().int().min(3).max(20),
    why: z.string().trim().min(1).max(140),
  })
  .strict();

export const gymConsultSchema = z
  .object({
    splitLabel: z.string().trim().min(1).max(40),
    rationale: z.string().trim().min(1).max(280),
    picks: z.array(gymConsultPickSchema).min(3).max(8),
  })
  .strict();

export type GymConsult = z.infer<typeof gymConsultSchema>;
