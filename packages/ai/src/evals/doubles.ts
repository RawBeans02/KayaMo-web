import type {
  CocoProvider,
  CocoProviderRequest,
  CocoProviderResult,
} from '../coco-router';
import type { CocoContextSnapshot, CocoModelOutput } from '../contracts';

/**
 * Test doubles for the eval suite.
 *
 * `CocoProvider` is a one-method interface and the router owns all validation
 * (`output` is typed `unknown`), so a fake is a handful of lines. That seam is
 * what makes a deterministic eval tier possible at all — everything below runs
 * with no network, no key and no cost.
 */

/** One shared snapshot. Cases express themselves as a diff against this. */
export function baselineContext(
  overrides: Partial<CocoContextSnapshot> = {},
): CocoContextSnapshot {
  return {
    version: 1,
    logicalDate: '2026-08-22',
    timezone: 'Asia/Manila',
    recommendedAction: {
      kind: 'task',
      recordId: 'task-1',
      title: 'Prepare breakfast',
    },
    tasks: [{ id: 'task-1', title: 'Prepare breakfast', completed: false, dueAt: null }],
    routines: [],
    goals: [],
    health: { mealsLogged: 0, weightLogged: false, workoutStatus: 'none' },
    memories: [],
    permissions: {
      goals_planning: true,
      physical_self: true,
      memory: false,
      faith: false,
      identity: false,
    },
    ...overrides,
  };
}

/** A structurally valid reply, for cases that care about routing, not wording. */
export function validOutput(overrides: Partial<CocoModelOutput> = {}): CocoModelOutput {
  return {
    message: 'Prepare breakfast is the one still open. Want to start there?',
    tone: 'balanced',
    proposals: [],
    citations: [{ recordType: 'task', recordId: 'task-1', label: 'Prepare breakfast' }],
    ...overrides,
  };
}

export type RecordingProvider = CocoProvider & {
  /** Every request the router handed the provider, in order. */
  readonly calls: CocoProviderRequest[];
  /** The system prompt of the most recent call. */
  lastSystemPrompt(renderSystem: (c: CocoContextSnapshot) => string): string;
};

/**
 * Captures what the router sends without answering meaningfully.
 *
 * Most persona regressions are assembly regressions — a block that stopped
 * being included, a permission that stopped gating — and those are visible
 * here, for free, without a model.
 */
export function recordingProvider(output: CocoModelOutput = validOutput()): RecordingProvider {
  const calls: CocoProviderRequest[] = [];
  return {
    calls,
    lastSystemPrompt(renderSystem) {
      const last = calls.at(-1);
      if (!last) throw new Error('provider was never called');
      return renderSystem(last.context);
    },
    async generate(request: CocoProviderRequest): Promise<CocoProviderResult> {
      calls.push(request);
      return {
        output,
        model: 'recording-double',
        inputTokens: 1,
        outputTokens: 1,
        costUsd: 0,
      };
    },
  };
}

/**
 * Replays a recorded reply for a case id. Lets the voice rubric run over real
 * model output with no network — the baselines are recorded once, reviewed in
 * the diff, and then the suite is deterministic.
 */
export function scriptedProvider(replies: Record<string, CocoModelOutput>): CocoProvider {
  return {
    async generate(request: CocoProviderRequest): Promise<CocoProviderResult> {
      const reply = replies[request.requestId];
      if (!reply) throw new Error(`no scripted reply for "${request.requestId}"`);
      return {
        output: reply,
        model: 'scripted-double',
        inputTokens: 1,
        outputTokens: 1,
        costUsd: 0,
      };
    },
  };
}
