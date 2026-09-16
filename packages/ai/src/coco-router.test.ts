import { describe, expect, it, vi } from 'vitest';
import { InMemoryCocoBudgetStore } from './budget';
import type { CocoRequest } from './contracts';
import {
  createCocoRouter,
  type CocoProvider,
  type CocoTelemetryEvent,
} from './coco-router';

function request(overrides: Partial<CocoRequest> = {}): CocoRequest {
  return {
    requestId: 'request-1',
    userId: 'user-1',
    mode: 'chat',
    message: 'What should I do next?',
    allowedActions: ['create_task', 'complete_task', 'start_focus'],
    context: {
      version: 1,
      logicalDate: '2026-08-22',
      timezone: 'Asia/Manila',
      recommendedAction: {
        kind: 'task',
        recordId: 'task-1',
        title: 'Prepare breakfast',
      },
      tasks: [
        {
          id: 'task-1',
          title: 'Prepare breakfast',
          completed: false,
          dueAt: null,
        },
      ],
      routines: [],
      health: { mealsLogged: 0, weightLogged: false, workoutStatus: 'none' },
      goals: [],
      memories: [],
      permissions: {
        goals_planning: true,
        physical_self: true,
        faith: false,
        identity: false,
        memory: false,
      },
    },
    ...overrides,
  };
}

function provider(output: unknown): CocoProvider {
  return {
    generate: vi.fn(async () => ({
      output,
      model: 'fake-model',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.002,
    })),
  };
}

const validOutput = {
  message: 'Start with breakfast. One small action is enough.',
  tone: 'balanced',
  proposals: [
    {
      proposalId: 'proposal-1',
      action: 'complete_task',
      summary: 'Mark breakfast preparation complete',
      requiresConfirmation: true,
      arguments: { taskId: 'task-1' },
    },
  ],
  citations: [{ recordType: 'task', recordId: 'task-1', label: 'Prepare breakfast' }],
};

describe('governed Coco router', () => {
  it('returns only validated, authorized proposals and records content-free telemetry', async () => {
    const events: CocoTelemetryEvent[] = [];
    const route = createCocoRouter({
      provider: provider(validOutput),
      budget: new InMemoryCocoBudgetStore(),
      telemetry: { record: async (event) => void events.push(event) },
    });

    const result = await route(request());

    expect(result.source).toBe('model');
    expect(result.response.proposals[0]?.requiresConfirmation).toBe(true);
    expect(result.response.safety.level).toBe('safe');
    expect(events).toHaveLength(1);
    expect(events[0]).not.toHaveProperty('message');
    expect(events[0]).not.toHaveProperty('context');
    expect(JSON.stringify(events[0])).not.toContain('Prepare breakfast');
  });

  it('keeps malformed model output away from the UI and returns a deterministic fallback', async () => {
    const route = createCocoRouter({
      provider: provider({ message: 42, proposals: 'write it now' }),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });

    const result = await route(request());

    expect(result.source).toBe('fallback');
    expect(result.response.proposals).toEqual([]);
    expect(result.response.message).toContain('Prepare breakfast');
  });

  it('rejects unconfirmed and unauthorized writes', async () => {
    const unconfirmed = structuredClone(validOutput);
    unconfirmed.proposals[0]!.requiresConfirmation = false;
    const unconfirmedRoute = createCocoRouter({
      provider: provider(unconfirmed),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    expect((await unconfirmedRoute(request())).source).toBe('fallback');

    const unauthorized = structuredClone(validOutput);
    unauthorized.proposals[0]!.action = 'complete_task';
    const unauthorizedRoute = createCocoRouter({
      provider: provider(unauthorized),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    expect(
      (await unauthorizedRoute(request({ allowedActions: ['create_task'] }))).source,
    ).toBe('fallback');
  });

  /**
   * The 2026-09-15 QA found a permission refusal reported as a network outage
   * ("I couldn't reach Mus's AI right now"), which sent users looking for a
   * problem that did not exist while the remedy was one toggle away.
   */
  describe('a refusal explains itself', () => {
    const PROPOSALS = {
      log_food: {
        proposalId: 'p-1',
        action: 'log_food',
        summary: 'Log adobo',
        requiresConfirmation: true,
        arguments: { inputHint: 'adobo' },
      },
      start_workout: {
        proposalId: 'p-1',
        action: 'start_workout',
        summary: 'Start push day',
        requiresConfirmation: true,
        arguments: { notes: null },
      },
      create_goal: {
        proposalId: 'p-1',
        action: 'create_goal',
        summary: 'Create a writing goal',
        requiresConfirmation: true,
        arguments: {
          title: 'Write daily',
          description: null,
          kind: 'goal',
          targetDate: null,
        },
      },
      remember_this: {
        proposalId: 'p-1',
        action: 'remember_this',
        summary: 'Remember the morning preference',
        requiresConfirmation: true,
        arguments: { kind: 'preference', content: 'Prefers mornings' },
      },
    } as const;

    async function refuse(action: keyof typeof PROPOSALS) {
      const route = createCocoRouter({
        provider: provider({
          message: 'Proposing that now.',
          tone: 'balanced',
          proposals: [PROPOSALS[action]],
          citations: [],
        }),
        budget: new InMemoryCocoBudgetStore(),
        config: { maxRetries: 0 },
      });
      return route(request({ allowedActions: ['create_task'] }));
    }

    it.each([
      ['log_food', 'food, nutrition and workouts'],
      ['start_workout', 'food, nutrition and workouts'],
      ['create_goal', 'goals and planning'],
      ['remember_this', 'saved memories'],
    ] as const)('names the permission %s needed', async (action, phrase) => {
      const result = await refuse(action);
      expect(result.source).toBe('fallback');
      expect(result.response.message).toContain(phrase);
      expect(result.response.message).toContain('Context access');
      expect(result.response.message).not.toMatch(/could not reach|couldn't reach/i);
    });

    it('says so plainly when the action is simply not offered here', async () => {
      // `create_time_block` is a task action, so it maps to no permission
      // domain. It is still a refusal, and must not read as an outage.
      const route = createCocoRouter({
        provider: provider({
          message: 'Blocking that out now.',
          tone: 'balanced',
          proposals: [
            {
              proposalId: 'p-1',
              action: 'create_time_block',
              summary: 'Block 9 to 10',
              requiresConfirmation: true,
              arguments: {
                title: 'Deep work',
                logicalDate: '2026-08-22',
                start: '09:00',
                end: '10:00',
                flexibility: 'FLEXIBLE',
              },
            },
          ],
          citations: [],
        }),
        budget: new InMemoryCocoBudgetStore(),
        config: { maxRetries: 0 },
      });
      const result = await route(request({ allowedActions: ['create_task'] }));
      expect(result.source).toBe('fallback');
      expect(result.response.message).toContain('not something I can do from here');
      expect(result.response.message).not.toMatch(/could not reach/i);
    });

    it('still blames nothing in particular when the provider genuinely fails', async () => {
      const route = createCocoRouter({
        provider: { generate: async () => { throw new Error('network down'); } },
        budget: new InMemoryCocoBudgetStore(),
        config: { maxRetries: 0 },
      });
      const result = await route(request());
      expect(result.response.message).toContain('could not reach Lis');
    });

    it('never calls the assistant Mus or Coco', async () => {
      const denied = await refuse('log_food');
      const failed = createCocoRouter({
        provider: { generate: async () => { throw new Error('network down'); } },
        budget: new InMemoryCocoBudgetStore(),
        config: { maxRetries: 0 },
      });
      const outage = await failed(request());
      for (const message of [denied.response.message, outage.response.message]) {
        expect(message).not.toMatch(/\b(?:Mus|Coco)\b/);
      }
    });
  });

  it('rejects citations to records outside the permitted snapshot', async () => {
    const invented = structuredClone(validOutput);
    invented.citations[0]!.recordId = 'task-from-another-user';
    const route = createCocoRouter({
      provider: provider(invented),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });

    const result = await route(request());

    expect(result.source).toBe('fallback');
    expect(result.response.citations[0]?.recordId).toBe('task-1');
  });

  it('allows workout claims only when the workout is present in confirmed context', async () => {
    const workoutOutput = {
      ...validOutput,
      proposals: [],
      citations: [
        { recordType: 'workout', recordId: 'workout-1', label: 'Back Squat session' },
      ],
    };
    const route = createCocoRouter({
      provider: provider(workoutOutput),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    const result = await route(
      request({
        context: {
          ...request().context,
          health: {
            ...request().context.health,
            workoutStatus: 'completed',
            confirmedWorkouts: [
              {
                id: 'workout-1',
                status: 'completed',
                startedAt: '2026-08-22T08:00:00.000Z',
                endedAt: '2026-08-22T09:00:00.000Z',
                setsCompleted: 3,
                exerciseNames: ['Back Squat'],
                bestE1rmKg: 112.5,
                isDeload: false,
              },
            ],
          },
        },
      }),
    );
    expect(result.response.citations[0]?.recordId).toBe('workout-1');

    const invented = structuredClone(workoutOutput);
    invented.citations[0]!.recordId = 'workout-2';
    const inventedRoute = createCocoRouter({
      provider: provider(invented),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    const rejected = await inventedRoute(request());
    expect(rejected.source).toBe('fallback');
  });

  it('permits goal proposals only as confirmation-required proposals', async () => {
    const goalOutput = {
      message: 'We can shape this into a four-week campaign if you want.',
      tone: 'balanced',
      proposals: [
        {
          proposalId: 'goal-proposal-1',
          action: 'create_goal',
          summary: 'Create a four-week morning campaign',
          requiresConfirmation: true,
          arguments: {
            title: 'Four-week morning reset',
            description: null,
            kind: 'campaign',
            targetDate: '2026-09-19',
          },
        },
      ],
      citations: [],
    };
    const route = createCocoRouter({
      provider: provider(goalOutput),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    const accepted = await route(request({ allowedActions: ['create_goal'] }));
    expect(accepted.source).toBe('model');
    expect(accepted.response.proposals[0]?.action).toBe('create_goal');

    const unconfirmed = structuredClone(goalOutput);
    unconfirmed.proposals[0]!.requiresConfirmation = false;
    const rejectedRoute = createCocoRouter({
      provider: provider(unconfirmed),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    expect(
      (await rejectedRoute(request({ allowedActions: ['create_goal'] }))).source,
    ).toBe('fallback');
  });

  it('allows explanation of a supplied code-derived target but rejects invented guidance', async () => {
    const base = request();
    const context = {
      ...base.context,
      health: {
        ...base.context.health,
        nutritionGuidance: {
          targetId: 'target-1',
          expenditureId: 'estimate-1',
          targetKcal: 2_000,
          targetProteinG: 130,
          loggedKcal: 800,
          loggedProteinG: 50,
          source: 'target_engine' as const,
          confidence: 0.7,
        },
      },
    };
    const grounded = {
      message: 'Your code-derived target is available.',
      tone: 'balanced',
      proposals: [],
      citations: [{ recordType: 'target', recordId: 'target-1', label: 'Daily target' }],
    };
    const groundedRoute = createCocoRouter({
      provider: provider(grounded),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    expect((await groundedRoute(request({ context }))).source).toBe('model');

    const inventedRoute = createCocoRouter({
      provider: provider({
        ...grounded,
        citations: [
          { recordType: 'target', recordId: 'target-other', label: 'Invented target' },
        ],
      }),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    expect((await inventedRoute(request({ context }))).source).toBe('fallback');
  });

  it('does not send diary, vent, or prayer content to a provider', async () => {
    const fake = provider(validOutput);
    const route = createCocoRouter({
      provider: fake,
      budget: new InMemoryCocoBudgetStore(),
    });

    const result = await route(
      request({ mode: 'diary', message: 'A private journal entry' }),
    );

    expect(result.source).toBe('fallback');
    expect(result.response.message).toContain('stays on this device');
    expect(fake.generate).not.toHaveBeenCalled();
  });

  it('permits exact Scripture citations only when faith context is enabled', async () => {
    const scriptureOutput = {
      message: 'Here is the reviewed passage you enabled.',
      tone: 'gentle',
      proposals: [],
      citations: [
        { recordType: 'scripture', recordId: 'passage-1', label: 'Psalm 23:1–3' },
      ],
    };
    const faithContext = {
      ...request().context,
      permissions: { ...request().context.permissions, faith: true },
      scripture: [
        {
          id: 'passage-1', reference: 'Psalm 23:1–3', text: 'Reviewed exact text',
          translation: 'engwebp' as const, sourceUrl: 'https://ebible.org/engwebp/PSA023.htm',
          tags: ['hope'],
        },
      ],
    };
    const route = createCocoRouter({
      provider: provider(scriptureOutput), budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    expect((await route(request({ context: faithContext }))).source).toBe('model');

    const disabledContext = {
      ...faithContext,
      permissions: { ...faithContext.permissions, faith: false },
    };
    expect((await route(request({ context: disabledContext }))).source).toBe('fallback');
  });

  it('stops before the provider for urgent safety input', async () => {
    const fake = provider(validOutput);
    const route = createCocoRouter({
      provider: fake,
      budget: new InMemoryCocoBudgetStore(),
    });

    const result = await route(request({ message: 'I want to kill myself' }));

    expect(result.source).toBe('safety');
    expect(result.response.safety.showEmergencyPrompt).toBe(true);
    expect(result.response.proposals).toEqual([]);
    expect(fake.generate).not.toHaveBeenCalled();
  });

  it('uses the budget fallback without calling the provider', async () => {
    const budget = new InMemoryCocoBudgetStore();
    await budget.recordUsage({
      userId: 'user-1',
      logicalDate: '2026-08-22',
      requestId: 'earlier',
      costUsd: 0.05,
    });
    const fake = provider(validOutput);
    const route = createCocoRouter({ provider: fake, budget });

    const result = await route(request());

    expect(result.source).toBe('budget');
    expect(fake.generate).not.toHaveBeenCalled();
  });

  it('retries a provider failure once', async () => {
    const generate = vi
      .fn<CocoProvider['generate']>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({
        output: validOutput,
        model: 'fake-model',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.002,
      });
    const route = createCocoRouter({
      provider: { generate },
      budget: new InMemoryCocoBudgetStore(),
    });

    expect((await route(request())).source).toBe('model');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('keeps a gym-time create_task when scheduledFor is a datetime', async () => {
    const gymOutput = {
      message:
        'A 10 pm gym session can be a great reset. Want a reminder task for it?',
      tone: 'balanced',
      proposals: [
        {
          proposalId: 'proposal-gym-10pm',
          action: 'create_task',
          summary: 'Create a task for a gym session at 10:00 pm today.',
          requiresConfirmation: true,
          arguments: {
            title: 'Go to the gym',
            notes: null,
            scheduledFor: '2026-08-26T22:00:00+08:00',
            dueAt: null,
          },
        },
      ],
      citations: [],
    };
    const route = createCocoRouter({
      provider: provider(gymOutput),
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });

    const result = await route(request({ allowedActions: ['create_task'] }));
    expect(result.source).toBe('model');
    const proposal = result.response.proposals[0];
    expect(proposal?.action).toBe('create_task');
    if (proposal?.action === 'create_task') {
      expect(proposal.arguments.scheduledFor).toBe('2026-08-26');
      expect(proposal.arguments.dueAt).toBe('2026-08-26T22:00:00+08:00');
    }
  });
});
