import type {
  CocoContextSnapshot,
  LisCompanionProfileContext,
  LisIdentityContext,
} from './contracts';
import { CONTEXT_LIMITS, truncateWords } from './context-limits';
import {
  MUS_CONTEXT_PERMISSION_DOMAINS,
  defaultMusContextPermissions,
  musContextPermissionsSchema,
  type MusContextPermissionDomain,
  type MusContextPermissions,
} from './context-permissions';

type RecommendedAction = CocoContextSnapshot['recommendedAction'];
type HealthContext = CocoContextSnapshot['health'];

export type GoalsPlanningContextProjection = {
  tasks: CocoContextSnapshot['tasks'];
  routines: CocoContextSnapshot['routines'];
  goals: CocoContextSnapshot['goals'];
  recommendedAction: RecommendedAction | null;
};

export type PhysicalSelfContextProjection = {
  health: HealthContext;
  recommendedAction: RecommendedAction | null;
};

export type MemoryContextProjection = {
  memories: CocoContextSnapshot['memories'];
};

export type IdentityContextProjection = {
  identity: LisIdentityContext;
};

export type FaithContextProjection = {
  scripture: NonNullable<CocoContextSnapshot['scripture']>;
};

export type MusContextDomainLoaders = {
  goals_planning: () => Promise<GoalsPlanningContextProjection>;
  physical_self: () => Promise<PhysicalSelfContextProjection>;
  memory: () => Promise<MemoryContextProjection>;
  faith: () => Promise<FaithContextProjection>;
  identity: () => Promise<IdentityContextProjection>;
};

export type MusContextAuthorizationAudit = {
  requestedDomains: MusContextPermissionDomain[];
  grantedDomains: MusContextPermissionDomain[];
  omittedDomains: MusContextPermissionDomain[];
  permissionLookupFailed: boolean;
  domainLoadFailures: MusContextPermissionDomain[];
  /** Collections the clamp had to cut. Truncation must be observable. */
  truncatedDomains: MusContextPermissionDomain[];
};

/**
 * No loader applies a limit, so the snapshot is capped here — the one place it
 * is assembled — rather than trusting every caller to remember. Returns the
 * domains it had to cut so the audit can say so instead of silently shrinking
 * what the model is allowed to see.
 */
export function clampCocoContext(context: CocoContextSnapshot): {
  context: CocoContextSnapshot;
  truncated: MusContextPermissionDomain[];
} {
  const truncated = new Set<MusContextPermissionDomain>();
  const take = <T,>(rows: readonly T[], max: number, domain: MusContextPermissionDomain): T[] => {
    if (rows.length > max) truncated.add(domain);
    return rows.slice(0, max);
  };

  const health = context.health;
  const clamped: CocoContextSnapshot = {
    ...context,
    tasks: take(context.tasks, CONTEXT_LIMITS.tasks, 'goals_planning'),
    routines: take(context.routines, CONTEXT_LIMITS.routines, 'goals_planning'),
    goals: take(context.goals, CONTEXT_LIMITS.goals, 'goals_planning'),
    // Content is cut too: twenty memories at full storage length is more prompt
    // than everything else in the snapshot combined.
    memories: take(context.memories, CONTEXT_LIMITS.memories, 'memory').map((row) => ({
      ...row,
      content: truncateWords(row.content, CONTEXT_LIMITS.memoryContentChars),
    })),
    health: health.confirmedWorkouts
      ? {
          ...health,
          confirmedWorkouts: take(
            health.confirmedWorkouts,
            CONTEXT_LIMITS.confirmedWorkouts,
            'physical_self',
          ).map((row) => ({
            ...row,
            exerciseNames: row.exerciseNames.slice(0, CONTEXT_LIMITS.exerciseNames),
          })),
        }
      : health,
    scripture: context.scripture
      ? take(context.scripture, CONTEXT_LIMITS.scripture, 'faith')
      : context.scripture,
    identity: context.identity
      ? {
          ...context.identity,
          rules: take(context.identity.rules, CONTEXT_LIMITS.personalRules, 'identity'),
        }
      : context.identity,
  };
  return { context: clamped, truncated: [...truncated] };
}

const emptyHealth = (): HealthContext => ({
  mealsLogged: 0,
  weightLogged: false,
  workoutStatus: 'none',
  confirmedWorkouts: [],
  nutritionGuidance: null,
});

export async function buildAuthorizedCocoContext(input: {
  logicalDate: string;
  timezone: string;
  readPermissions: () => Promise<MusContextPermissions>;
  loaders: MusContextDomainLoaders;
  /**
   * How the user wants Lis to speak. Read unconditionally and outside the
   * permission loop on purpose: gating it behind a domain that defaults false
   * would mean the persona silently does not apply for every new user.
   */
  readCompanionProfile?: () => Promise<LisCompanionProfileContext | null>;
}): Promise<{ context: CocoContextSnapshot; audit: MusContextAuthorizationAudit }> {
  let configured = defaultMusContextPermissions();
  let permissionLookupFailed = false;
  try {
    configured = musContextPermissionsSchema.parse(await input.readPermissions());
  } catch {
    permissionLookupFailed = true;
  }

  const effective = defaultMusContextPermissions();
  const domainLoadFailures: MusContextPermissionDomain[] = [];
  let goalsPlanning: GoalsPlanningContextProjection | null = null;
  let physicalSelf: PhysicalSelfContextProjection | null = null;
  let memory: MemoryContextProjection | null = null;
  let faith: FaithContextProjection | null = null;

  if (!permissionLookupFailed && configured.goals_planning) {
    try {
      goalsPlanning = await input.loaders.goals_planning();
      effective.goals_planning = true;
    } catch {
      domainLoadFailures.push('goals_planning');
    }
  }
  if (!permissionLookupFailed && configured.physical_self) {
    try {
      physicalSelf = await input.loaders.physical_self();
      effective.physical_self = true;
    } catch {
      domainLoadFailures.push('physical_self');
    }
  }
  if (!permissionLookupFailed && configured.memory) {
    try {
      memory = await input.loaders.memory();
      effective.memory = true;
    } catch {
      domainLoadFailures.push('memory');
    }
  }
  let identity: IdentityContextProjection | null = null;
  if (!permissionLookupFailed && configured.identity) {
    try {
      identity = await input.loaders.identity();
      effective.identity = true;
    } catch {
      domainLoadFailures.push('identity');
    }
  }
  if (!permissionLookupFailed && configured.faith) {
    try {
      faith = await input.loaders.faith();
      effective.faith = true;
    } catch {
      domainLoadFailures.push('faith');
    }
  }

  const recommendedAction = goalsPlanning?.recommendedAction ??
    physicalSelf?.recommendedAction ?? {
      kind: 'check_in' as const,
      recordId: null,
      title: 'Choose what would help next',
    };
  let companionProfile: LisCompanionProfileContext | undefined;
  if (input.readCompanionProfile) {
    try {
      companionProfile = (await input.readCompanionProfile()) ?? undefined;
    } catch {
      // A missing profile must never cost someone their assistant. The persona
      // simply stays impersonal.
      companionProfile = undefined;
    }
  }

  const context: CocoContextSnapshot = {
    version: 1,
    logicalDate: input.logicalDate,
    timezone: input.timezone,
    recommendedAction,
    tasks: goalsPlanning?.tasks ?? [],
    routines: goalsPlanning?.routines ?? [],
    health: physicalSelf?.health ?? emptyHealth(),
    goals: goalsPlanning?.goals ?? [],
    scripture: faith?.scripture,
    memories: memory?.memories ?? [],
    permissions: effective,
    companionProfile,
    identity: identity?.identity,
  };
  const grantedDomains = MUS_CONTEXT_PERMISSION_DOMAINS.filter(
    (domain) => effective[domain],
  );
  const { context: clamped, truncated } = clampCocoContext(context);
  return {
    context: clamped,
    audit: {
      truncatedDomains: truncated,
      requestedDomains: [...MUS_CONTEXT_PERMISSION_DOMAINS],
      grantedDomains,
      omittedDomains: MUS_CONTEXT_PERMISSION_DOMAINS.filter(
        (domain) => !effective[domain],
      ),
      permissionLookupFailed,
      domainLoadFailures,
    },
  };
}
