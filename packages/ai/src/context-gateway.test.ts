import { describe, expect, it, vi } from 'vitest';
import { InMemoryCocoBudgetStore } from './budget';
import { createCocoRouter, type CocoProviderRequest } from './coco-router';
import { buildAuthorizedCocoContext } from './context-gateway';
import { defaultMusContextPermissions } from './context-permissions';

const PRIVATE_GOAL = 'KAYAMO_PRIVATE_GOAL_SENTINEL_5534';
const PRIVATE_PHYSICAL = 'KAYAMO_PRIVATE_PHYSICAL_SENTINEL_3917';
const PRIVATE_MEMORY = 'KAYAMO_PRIVATE_MEMORY_SENTINEL_8821';
const PRIVATE_FAITH = 'KAYAMO_PRIVATE_FAITH_SENTINEL_6172';

function loaders() {
  return {
    goals_planning: vi.fn(async () => ({
      tasks: [{ id: 'task-1', title: PRIVATE_GOAL, completed: false, dueAt: null }],
      routines: [],
      goals: [],
      recommendedAction: {
        kind: 'task' as const,
        recordId: 'task-1',
        title: PRIVATE_GOAL,
      },
    })),
    physical_self: vi.fn(async () => ({
      health: {
        mealsLogged: 1,
        weightLogged: true,
        workoutStatus: 'completed' as const,
        confirmedWorkouts: [
          {
            id: 'workout-1',
            status: 'completed' as const,
            startedAt: '2026-08-28T01:00:00.000Z',
            endedAt: '2026-08-28T02:00:00.000Z',
            setsCompleted: 1,
            exerciseNames: [PRIVATE_PHYSICAL],
            bestE1rmKg: 80,
            isDeload: false,
          },
        ],
        nutritionGuidance: null,
      },
      recommendedAction: null,
    })),
    memory: vi.fn(async () => ({
      memories: [{ id: 'memory-1', kind: 'preference', content: PRIVATE_MEMORY }],
    })),
    faith: vi.fn(async () => ({
      scripture: [
        {
          id: 'verse-1',
          reference: 'Test 1:1',
          text: PRIVATE_FAITH,
          translation: 'engwebp' as const,
          sourceUrl: 'https://example.test/verse',
          tags: ['hope'],
        },
      ],
    })),
    identity: vi.fn(async () => ({
      identity: { futureSelf: null, compass: null, rules: [] },
    })),
  };
}

async function build(
  permissions: ReturnType<typeof defaultMusContextPermissions>,
  domainLoaders = loaders(),
) {
  return {
    result: await buildAuthorizedCocoContext({
      logicalDate: '2026-08-28',
      timezone: 'Asia/Manila',
      readPermissions: async () => permissions,
      loaders: domainLoaders,
    }),
    domainLoaders,
  };
}

describe('Mus context authorization gateway', () => {
  it('defaults every stored-data domain off and never loads private rows', async () => {
    const { result, domainLoaders } = await build(defaultMusContextPermissions());
    const serialized = JSON.stringify(result.context);

    expect(serialized).not.toContain(PRIVATE_GOAL);
    expect(serialized).not.toContain(PRIVATE_PHYSICAL);
    expect(serialized).not.toContain(PRIVATE_MEMORY);
    expect(serialized).not.toContain(PRIVATE_FAITH);
    expect(result.context.permissions).toEqual(defaultMusContextPermissions());
    expect(result.audit.grantedDomains).toEqual([]);
    for (const loader of Object.values(domainLoaders))
      expect(loader).not.toHaveBeenCalled();
  });

  it('includes only domains with an explicit grant', async () => {
    const permissions = defaultMusContextPermissions();
    permissions.goals_planning = true;
    permissions.memory = true;
    const { result, domainLoaders } = await build(permissions);
    const serialized = JSON.stringify(result.context);

    expect(serialized).toContain(PRIVATE_GOAL);
    expect(serialized).toContain(PRIVATE_MEMORY);
    expect(serialized).not.toContain(PRIVATE_PHYSICAL);
    expect(serialized).not.toContain(PRIVATE_FAITH);
    expect(domainLoaders.goals_planning).toHaveBeenCalledOnce();
    expect(domainLoaders.memory).toHaveBeenCalledOnce();
    expect(domainLoaders.physical_self).not.toHaveBeenCalled();
    expect(domainLoaders.faith).not.toHaveBeenCalled();
  });

  it('applies revocation to the next context construction', async () => {
    const permissions = defaultMusContextPermissions();
    permissions.physical_self = true;
    const domainLoaders = loaders();
    const before = await build(permissions, domainLoaders);
    permissions.physical_self = false;
    const after = await build(permissions, domainLoaders);

    expect(JSON.stringify(before.result.context)).toContain(PRIVATE_PHYSICAL);
    expect(JSON.stringify(after.result.context)).not.toContain(PRIVATE_PHYSICAL);
    expect(domainLoaders.physical_self).toHaveBeenCalledOnce();
  });

  it('fails closed when permission lookup fails', async () => {
    const domainLoaders = loaders();
    const result = await buildAuthorizedCocoContext({
      logicalDate: '2026-08-28',
      timezone: 'Asia/Manila',
      readPermissions: async () => {
        throw new Error('database unavailable');
      },
      loaders: domainLoaders,
    });

    expect(result.context.permissions).toEqual(defaultMusContextPermissions());
    expect(result.audit.permissionLookupFailed).toBe(true);
    for (const loader of Object.values(domainLoaders))
      expect(loader).not.toHaveBeenCalled();
  });

  it('does not leak another user through a user-scoped loader', async () => {
    const userRows = {
      a: PRIVATE_MEMORY,
      b: 'USER_B_MEMORY_SENTINEL_1428',
    } as const;
    const permissions = defaultMusContextPermissions();
    permissions.memory = true;
    const userId: keyof typeof userRows = 'b';
    const domainLoaders = loaders();
    domainLoaders.memory.mockImplementation(async () => ({
      memories: [{ id: 'memory-b', kind: 'fact', content: userRows[userId] }],
    }));
    const { result } = await build(permissions, domainLoaders);

    expect(JSON.stringify(result.context)).toContain(userRows.b);
    expect(JSON.stringify(result.context)).not.toContain(userRows.a);
  });

  it('passes the sanitized snapshot, not raw loader data, to the model provider', async () => {
    const permissions = defaultMusContextPermissions();
    const { result } = await build(permissions);
    const received: CocoProviderRequest[] = [];
    const route = createCocoRouter({
      provider: {
        generate: async (request) => {
          received.push(request);
          return {
            output: {
              message: 'What would help you most right now?',
              tone: 'balanced',
              proposals: [],
              citations: [],
            },
            model: 'privacy-fixture',
            inputTokens: 1,
            outputTokens: 1,
            costUsd: 0,
          };
        },
      },
      budget: new InMemoryCocoBudgetStore(),
    });

    await route({
      requestId: 'privacy-request',
      userId: 'user-b',
      mode: 'chat',
      message: 'Help me choose what is next.',
      context: result.context,
      allowedActions: [],
    });

    const serialized = JSON.stringify(received[0]?.context);
    expect(serialized).not.toContain(PRIVATE_GOAL);
    expect(serialized).not.toContain(PRIVATE_PHYSICAL);
    expect(serialized).not.toContain(PRIVATE_MEMORY);
    expect(serialized).not.toContain(PRIVATE_FAITH);
  });
});
