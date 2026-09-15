import { describe, expect, it } from 'vitest';
import { InMemoryCocoBudgetStore } from '../budget';
import { createCocoRouter } from '../coco-router';
import {
  LIS_PERSONA_VERSION,
  lisPersonaFingerprint,
  renderLisBasePersona,
  renderLisIdentityCard,
  renderLisSystemPrompt,
} from '../persona';
import { baselineContext, recordingProvider } from './doubles';
import { LIS_EVAL_CASES, LIS_EVAL_GROUPS, casesInGroup } from './cases';

/**
 * Tier 1a — prompt assembly. The highest-value, lowest-cost layer, because most
 * persona regressions are assembly regressions: a block that stopped being
 * included, a permission that stopped gating, a name that came back. None of it
 * needs a model.
 */

describe('the persona cannot drift silently', () => {
  /**
   * Pairs the wording with a version number. Editing the persona without
   * bumping LIS_PERSONA_VERSION fails here, which is the point: the change has
   * to announce itself in the diff and invalidate the recorded baselines
   * deliberately rather than quietly.
   */
  const FINGERPRINTS: Record<number, string> = {
    // 1 was the same wording under the name Kai, before the rename to Lis.
    2: '8803c6d2bdef9a7e1d471f9bd5b9016460b202e7941c07c8ecba8b8470281fa6',
  };

  it('matches the fingerprint recorded for its version', () => {
    const expected = FINGERPRINTS[LIS_PERSONA_VERSION];
    expect(
      expected,
      `No fingerprint recorded for LIS_PERSONA_VERSION ${LIS_PERSONA_VERSION}. ` +
        `If you changed the persona on purpose, add: ${LIS_PERSONA_VERSION}: '${lisPersonaFingerprint()}'`,
    ).toBeDefined();
    expect(
      lisPersonaFingerprint(),
      'The persona changed without a version bump. Bump LIS_PERSONA_VERSION and ' +
        're-record baselines rather than editing this hash to match.',
    ).toBe(expected);
  });
});

describe('the assembled system prompt', () => {
  const prompt = () => renderLisSystemPrompt(baselineContext());

  it('names the assistant Lis and nothing else', () => {
    expect(prompt()).toContain("You are Lis, KayaMo's supportive AI companion.");
    expect(prompt()).not.toMatch(/\b(?:Mus|Coco)\b/);
  });

  it.each([
    ['nutrition boundary', 'Nutrition calculation is outside your authority'],
    ['confirmation rule', 'set requiresConfirmation to true for every proposal'],
    ['three-proposal cap', 'Propose at most three actions'],
    ['no-fabrication', 'Never invent completed activity'],
    ['faith opt-in', 'Faith content is opt-in'],
    ['no false execution', 'Do not claim an action was executed'],
    ['no shame', 'Never shame missed days'],
  ])('keeps the %s clause', (_label, clause) => {
    expect(prompt()).toContain(clause);
  });

  it('is the base persona alone while nothing personalises it', () => {
    // Phase 4 fills the identity card. Until then the prompt must be exactly the
    // base persona — no placeholder, no "the user has not told you anything",
    // which reliably turns the first reply into an interrogation.
    expect(renderLisIdentityCard(baselineContext())).toBe('');
    expect(prompt()).toBe(renderLisBasePersona());
  });
});

describe('what the router actually sends the provider', () => {
  async function capture(context = baselineContext()) {
    const provider = recordingProvider();
    const route = createCocoRouter({
      provider,
      budget: new InMemoryCocoBudgetStore(),
      config: { maxRetries: 0 },
    });
    await route({
      requestId: 'capture-1',
      userId: 'user-1',
      mode: 'chat',
      message: 'what should i do next',
      context,
      allowedActions: ['create_task'],
    });
    return provider;
  }

  it('hands the provider the snapshot the gateway built', async () => {
    const provider = await capture();
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]!.context.tasks[0]!.title).toBe('Prepare breakfast');
  });

  it('renders a system prompt from that snapshot', async () => {
    const provider = await capture();
    const system = provider.lastSystemPrompt(renderLisSystemPrompt);
    expect(system).toContain('You are Lis');
  });

  /**
   * Record content belongs in the user turn as JSON, never in the system
   * position. Worth pinning now, before Phase 4 starts writing a per-user block
   * into the system prompt: the identity card may carry how someone wants to be
   * spoken to, but never their task titles or memories.
   */
  it('keeps record content out of the system prompt', async () => {
    const withRecords = baselineContext({
      permissions: {
        goals_planning: true,
        physical_self: true,
        memory: true,
        faith: false,
      },
      tasks: [
        { id: 'task-1', title: 'SENTINEL-TASK-TITLE', completed: false, dueAt: null },
      ],
      memories: [{ id: 'mem-1', kind: 'context', content: 'SENTINEL-MEMORY-CONTENT' }],
      recommendedAction: {
        kind: 'task',
        recordId: 'task-1',
        title: 'SENTINEL-TASK-TITLE',
      },
    });

    const system = renderLisSystemPrompt(withRecords);
    expect(system).not.toContain('SENTINEL-TASK-TITLE');
    expect(system).not.toContain('SENTINEL-MEMORY-CONTENT');

    // ...while the snapshot the provider receives still carries them, so this
    // is a placement assertion, not an accidental pass on empty input.
    const provider = await capture(withRecords);
    expect(JSON.stringify(provider.calls[0]!.context)).toContain('SENTINEL-TASK-TITLE');
  });

  it('carries the timezone that selects the crisis region', async () => {
    const provider = await capture();
    expect(provider.calls[0]!.context.timezone).toBe('Asia/Manila');
  });
});

describe('the case table', () => {
  it.each(LIS_EVAL_GROUPS)('has at least one %s case', (group) => {
    expect(casesInGroup(group).length).toBeGreaterThan(0);
  });

  it('uses unique, stable ids', () => {
    const ids = LIS_EVAL_CASES.map((testCase) => testCase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every case something to assert', () => {
    for (const testCase of LIS_EVAL_CASES) {
      const { source, mustMatch, mustNotMatch, bounds, judge } = testCase.expect;
      expect(
        Boolean(source || mustMatch || mustNotMatch || bounds || judge),
        `${testCase.id} asserts nothing`,
      ).toBe(true);
    }
  });
});
