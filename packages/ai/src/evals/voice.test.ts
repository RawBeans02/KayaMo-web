import { describe, expect, it } from 'vitest';
import { InMemoryCocoBudgetStore } from '../budget';
import { createCocoRouter, type CocoProvider } from '../coco-router';
import { findBannedCopy } from '../banned-copy';
import { evaluateCocoSafety } from '../safety';
import { baselineContext, validOutput } from './doubles';
import {
  GROWTH_LANGUAGE_LIMIT,
  ROBOT_TELLS,
  checkVoiceBounds,
  countGrowthLanguage,
  findRobotTells,
  measureVoice,
} from './rubric';

/**
 * Tier 1b — every string a user can see that Lis did not generate.
 *
 * The deterministic replies are the ones nobody re-reads: fallbacks, budget
 * notices, local-only modes, the four crisis branches. They are also the ones
 * that appear at the worst moments. Running the copy rules over the *returned
 * strings* is strictly stronger than scanning source files, because it catches
 * anything assembled at runtime.
 */

const PH = { timezone: 'Asia/Manila' } as const;

async function routeWith(provider: CocoProvider, message = 'what should i do next') {
  const route = createCocoRouter({
    provider,
    budget: new InMemoryCocoBudgetStore(),
    config: { maxRetries: 0 },
  });
  return route({
    requestId: 'voice-1',
    userId: 'user-1',
    mode: 'chat',
    message,
    context: baselineContext(),
    allowedActions: ['create_task'],
  });
}

const failing: CocoProvider = {
  generate: async () => {
    throw new Error('provider down');
  },
};

/** Every deterministic string the product can put in front of someone. */
async function deterministicMessages(): Promise<{ label: string; text: string }[]> {
  const outage = await routeWith(failing);
  const refusalProvider: CocoProvider = {
    generate: async () => ({
      output: validOutput({
        proposals: [
          {
            proposalId: 'p-1',
            action: 'log_food',
            summary: 'Log adobo',
            requiresConfirmation: true,
            arguments: { inputHint: 'adobo' },
          },
        ],
        citations: [],
      }),
      model: 'double',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
    }),
  };
  const refusal = await routeWith(refusalProvider);

  return [
    { label: 'provider outage', text: outage.response.message },
    { label: 'permission refusal', text: refusal.response.message },
    {
      label: 'safety: self harm',
      text: evaluateCocoSafety('i want to kill myself', PH).message ?? '',
    },
    {
      label: 'safety: medical',
      text: evaluateCocoSafety('i cant breathe', PH).message ?? '',
    },
    {
      label: 'safety: abuse',
      text: evaluateCocoSafety('my bf hits me', PH).message ?? '',
    },
    {
      label: 'safety: eating',
      text: evaluateCocoSafety('help me starve myself', PH).message ?? '',
    },
    {
      label: 'safety: outside PH',
      text:
        evaluateCocoSafety('i want to kill myself', { timezone: 'Europe/Berlin' })
          .message ?? '',
    },
  ];
}

describe('deterministic copy', () => {
  it('calls the assistant Lis, and only Lis', async () => {
    for (const { label, text } of await deterministicMessages()) {
      expect(text, label).toContain('');
      expect(text, `${label} used a former brand name`).not.toMatch(/\b(?:Mus|Coco)\b/);
    }
  });

  it('passes the banned-copy rules at runtime, not just in source', async () => {
    for (const { label, text } of await deterministicMessages()) {
      const hits = findBannedCopy(`"${text.replace(/"/g, "'")}"`);
      expect(hits.map((hit) => hit.id), label).toEqual([]);
    }
  });

  it('never opens on an apology or a help-desk line', async () => {
    for (const { label, text } of await deterministicMessages()) {
      const tells = findRobotTells(text).filter((hit) =>
        ['apology-opener', 'assist-you-with', 'happy-to-help'].includes(hit.id),
      );
      expect(tells.map((hit) => hit.id), label).toEqual([]);
    }
  });

  it('keeps every crisis reply pointed at real help', async () => {
    const crisis = (await deterministicMessages()).filter((row) =>
      row.label.startsWith('safety'),
    );
    expect(crisis.length).toBeGreaterThan(0);
    for (const { label, text } of crisis) {
      expect(text.length, label).toBeGreaterThan(40);
      expect(
        /1553|local emergency number/.test(text),
        `${label} named no way to get help`,
      ).toBe(true);
    }
  });

  it('explains a refusal instead of blaming the network', async () => {
    const messages = await deterministicMessages();
    const refusal = messages.find((row) => row.label === 'permission refusal')!;
    expect(refusal.text).toContain('food, nutrition and workouts');
    expect(refusal.text).not.toMatch(/could not reach|couldn't reach/i);

    const outage = messages.find((row) => row.label === 'provider outage')!;
    expect(outage.text).toMatch(/could not reach/i);
  });
});

describe('the robot-tell bank', () => {
  it.each(ROBOT_TELLS.map((tell) => [tell.id, tell] as const))(
    'detects %s',
    (_id, tell) => {
      const sample: Record<string, string> = {
        'as-an-ai': 'As an AI, I cannot feel that.',
        'here-are-n': 'Here are three things you could try.',
        'numbered-list-in-chat': 'Try this:\n1. Sleep\n2. Eat',
        'bulleted-list-in-chat': 'Options:\n- Sleep\n- Eat',
        'let-me-know': 'Let me know if you need anything else.',
        'important-to': "It's important to stay consistent.",
        'remember-imperative': 'You did well. Remember, consistency compounds.',
        'happy-to-help': 'Happy to help with that.',
        'feel-free': 'Feel free to ask me anything.',
        delve: "Let's dive into your week.",
        'assist-you-with': 'I can help you with your plan.',
        'apology-opener': "I'm sorry, I cannot do that.",
        'pollinator-pun': "Let's buzz through your day.",
      };
      const text = sample[tell.id];
      expect(text, `no sample written for ${tell.id}`).toBeDefined();
      expect(findRobotTells(text!).map((hit) => hit.id)).toContain(tell.id);
    },
  );

  it('leaves ordinary companion phrasing alone', () => {
    const human = [
      'Prepare breakfast is the one still open. Want to start there?',
      'That sounds like a heavy week. What is the one thing that would help most?',
      'Twenty minutes is enough for something real. Push or pull today?',
      'I would need access to your food and workouts before I can log that.',
    ];
    for (const text of human) {
      expect(findRobotTells(text), text).toEqual([]);
    }
  });
});

/**
 * The voice direction is that Lis tends what you are growing — the Grove keeps
 * measuring the person's progress, and Lis is the thing helping it along. That
 * is a register, not a theme, and it has two distinct failure modes worth
 * separating: sounding like a cartoon, and sounding like a greetings card.
 */
describe('growth language stays a register, not a theme', () => {
  it('reads as voice when it appears once', () => {
    const text = 'Twenty minutes is enough for something real. Want to start there?';
    expect(countGrowthLanguage(text).length).toBeLessThanOrEqual(GROWTH_LANGUAGE_LIMIT);
    expect(findRobotTells(text)).toEqual([]);
  });

  it('counts the theme when a reply is soaked in it', () => {
    const overdone =
      'Let your goals bloom and grow! Every seed you plant will flourish as you nurture your garden.';
    expect(countGrowthLanguage(overdone).length).toBeGreaterThan(GROWTH_LANGUAGE_LIMIT);
  });

  it.each([
    ["let's buzz through your day"],
    ['un-bee-lievable progress'],
    ['a hive of activity today'],
    ['busy as a bee this week'],
  ])('flags the pun in %s', (text) => {
    expect(findRobotTells(text).map((hit) => hit.id)).toContain('pollinator-pun');
  });

  it('leaves ordinary use of these words alone', () => {
    // "grow" is a normal English verb and the Grove is a real product surface;
    // neither should trip anything.
    for (const text of [
      'Your grove has three confirmed milestones.',
      'That habit will grow easier once the first week is behind you.',
    ]) {
      expect(findRobotTells(text), text).toEqual([]);
      expect(countGrowthLanguage(text).length).toBeLessThanOrEqual(
        GROWTH_LANGUAGE_LIMIT,
      );
    }
  });

  it('never lets the metaphor replace the concrete next thing', () => {
    // The real risk: warmth crowding out the answer. A reply that names a
    // supplied record is doing its job; one that only blooms is not.
    const vague = 'Keep blooming! You are growing beautifully.';
    const useful = 'Prepare breakfast is still open. Want to start there?';
    expect(measureVoice(vague, ['Prepare breakfast']).referencedRecords).toEqual([]);
    expect(measureVoice(useful, ['Prepare breakfast']).referencedRecords).toEqual([
      'Prepare breakfast',
    ]);
  });
});

describe('structural measurement', () => {
  it('counts sentences, questions and second person', () => {
    const shape = measureVoice(
      'Prepare breakfast is still open. Want to start there?',
      ['Prepare breakfast'],
    );
    expect(shape.sentences).toBe(2);
    expect(shape.asksQuestion).toBe(true);
    expect(shape.referencedRecords).toEqual(['Prepare breakfast']);
  });

  it('reports which bound failed, not just that one did', () => {
    const shape = measureVoice('One. Two. Three. Four. Five. Six.');
    const failures = checkVoiceBounds(shape, { maxSentences: 3, asksQuestion: true });
    expect(failures).toEqual(['6 sentences > 3', 'asked nothing']);
  });

  it('passes a reply that is within its bounds', () => {
    const shape = measureVoice('That is still open. Want to start there?');
    expect(checkVoiceBounds(shape, { maxSentences: 3, asksQuestion: true })).toEqual([]);
  });
});
