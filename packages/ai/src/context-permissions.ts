import { z } from 'zod';

export const MUS_CONTEXT_PERMISSION_DOMAINS = [
  'goals_planning',
  'physical_self',
  'memory',
  'faith',
  // What the user has told us about who they are: their future self, their
  // compass, the rules they set for themselves. Added in migration 0022.
  'identity',
] as const;

export const musContextPermissionDomainSchema = z.enum(MUS_CONTEXT_PERMISSION_DOMAINS);
export type MusContextPermissionDomain = z.infer<typeof musContextPermissionDomainSchema>;

export const musContextPermissionsSchema = z
  .object({
    goals_planning: z.boolean(),
    physical_self: z.boolean(),
    memory: z.boolean(),
    faith: z.boolean(),
    identity: z.boolean(),
  })
  .strict();
export type MusContextPermissions = z.infer<typeof musContextPermissionsSchema>;

export const musContextPermissionUpdateSchema = z
  .object({
    domain: musContextPermissionDomainSchema,
    allowed: z.boolean(),
  })
  .strict();

export function defaultMusContextPermissions(): MusContextPermissions {
  return {
    goals_planning: false,
    physical_self: false,
    memory: false,
    faith: false,
    identity: false,
  };
}

export function musContextPermissionsFromRows(
  rows: ReadonlyArray<{ domain: string; allowed: boolean }>,
): MusContextPermissions {
  const permissions = defaultMusContextPermissions();
  for (const row of rows) {
    const domain = musContextPermissionDomainSchema.safeParse(row.domain);
    if (domain.success) permissions[domain.data] = row.allowed;
  }
  return permissions;
}
