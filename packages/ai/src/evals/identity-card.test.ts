import { describe, expect, it } from 'vitest';
import type { LisCompanionProfileContext } from '../contracts';
import { renderLisBasePersona, renderLisIdentityCard, renderLisSystemPrompt } from '../persona';
import { baselineContext } from './doubles';

/**
 * The per-user block. Every rule here is a decision about what an absent value
 * should do, and the answer is always "say nothing" — a null placeholder
 * teaches the model to talk about the gaps instead of the person.
 */

function profile(
  overrides: Partial<LisCompanionProfileContext> = {},
): LisCompanionProfileContext {
  return {
    displayName: null,
    pronouns: null,
    languageRegister: 'match_me',
    dials: {
      encouragement: 'balanced',
      accountability: 'balanced',
      humor: 'balanced',
      proactivity: 'balanced',
    },
    aboutMe: null,
    avoidTopics: [],
    ...overrides,
  };
}

const card = (p?: Partial<LisCompanionProfileContext>) =>
  renderLisIdentityCard(
    baselineContext(p === undefined ? {} : { companionProfile: profile(p) }),
  );

describe('a user who has set nothing', () => {
  it('renders an empty card, not a description of the gap', () => {
    expect(card()).toBe('');
  });

  it('leaves the system prompt exactly the base persona', () => {
    expect(renderLisSystemPrompt(baselineContext())).toBe(renderLisBasePersona());
  });

  /**
   * The failure mode this guards: a line like "the user has not told you
   * anything about themselves" reliably turns the first reply into an
   * interrogation, which is the opposite of the point.
   */
  it('never mentions absence', () => {
    const rendered = card({ languageRegister: 'match_me' });
    expect(rendered).not.toMatch(/not set|unknown|no name|has not told/i);
  });

  it('says nothing when every dial sits at its midpoint', () => {
    // "balanced humour" is noise that spends tokens describing the default.
    expect(card({ languageRegister: 'english' })).not.toMatch(/balanced/);
  });
});

describe('a user who has set things', () => {
  it('uses their name and pronouns together', () => {
    expect(card({ displayName: 'Rovs', pronouns: 'they/them' })).toContain(
      'Call them Rovs (they/them).',
    );
  });

  it('handles a name without pronouns, and pronouns without a name', () => {
    expect(card({ displayName: 'Rovs' })).toContain('Call them Rovs.');
    expect(card({ displayName: 'Rovs' })).not.toMatch(/\(\s*\)/);
    expect(card({ pronouns: 'she/her' })).toContain('Their pronouns are she/her.');
  });

  it('carries only the dials that are off their midpoint', () => {
    const rendered = card({
      dials: {
        encouragement: 'high',
        accountability: 'balanced',
        humor: 'playful',
        proactivity: 'balanced',
      },
    });
    expect(rendered).toContain('generous with encouragement');
    expect(rendered).toContain('light touch');
    expect(rendered).not.toMatch(/firmly|stay serious|wait to be asked/);
  });

  it('passes their own words through verbatim', () => {
    const rendered = card({ aboutMe: 'I train early and I hate being nagged.' });
    expect(rendered).toContain('I train early and I hate being nagged.');
  });

  it('states topic boundaries as boundaries, not as subjects', () => {
    const rendered = card({ avoidTopics: ['weight', 'family'] });
    expect(rendered).toContain('Do not raise unless they raise it first: weight, family.');
  });

  it('joins onto the base persona rather than replacing it', () => {
    const prompt = renderLisSystemPrompt(
      baselineContext({ companionProfile: profile({ displayName: 'Rovs' }) }),
    );
    expect(prompt).toContain('You are Lis');
    expect(prompt).toContain('Nutrition calculation is outside your authority');
    expect(prompt).toContain('Call them Rovs.');
  });
});

describe('the card carries voice, never records', () => {
  /**
   * Pinned before Phase 4b adds identity facts: task titles and memories belong
   * in the context JSON where `authorizeOutput` can check citations against
   * them. The system prompt is for how to speak, not what is true.
   */
  it('contains no task titles or memory content', () => {
    const rendered = renderLisIdentityCard(
      baselineContext({
        companionProfile: profile({ displayName: 'Rovs' }),
        tasks: [
          { id: 'task-1', title: 'SENTINEL-TASK', completed: false, dueAt: null },
        ],
        memories: [{ id: 'm-1', kind: 'context', content: 'SENTINEL-MEMORY' }],
      }),
    );
    expect(rendered).not.toContain('SENTINEL-TASK');
    expect(rendered).not.toContain('SENTINEL-MEMORY');
  });

  it('stays well inside a sensible budget at maximum length', () => {
    const rendered = card({
      displayName: 'A'.repeat(40),
      pronouns: 'B'.repeat(24),
      aboutMe: 'C'.repeat(600),
      avoidTopics: Array.from({ length: 10 }, (_, i) => `topic-${i}`),
      dials: {
        encouragement: 'high',
        accountability: 'firm',
        humor: 'playful',
        proactivity: 'proactive',
      },
    });
    expect(rendered.length).toBeLessThan(1200);
  });
});

describe('identity facts, gated by the identity domain', () => {
  const identity = {
    futureSelf: { id: 'self' as const, statement: 'Someone who finishes what they start.' },
    compass: {
      id: 'self' as const,
      mattersNow: 'Getting the thesis out',
      protect: 'Mornings with my kid',
      strugglingWith: null,
      doNotBecome: 'Someone who only works',
      activeAreas: ['work', 'relationships'],
    },
    rules: [
      { id: 'rule-1', title: 'No work past 9pm' },
      { id: 'rule-2', title: 'One rest day a week' },
    ],
  };

  it('renders what they are moving toward, and their own rules', () => {
    const rendered = renderLisIdentityCard(baselineContext({ identity }));
    expect(rendered).toContain('Becoming: Someone who finishes what they start.');
    expect(rendered).toContain('Matters now: Getting the thesis out');
    expect(rendered).toContain('Protecting: Mornings with my kid');
    expect(rendered).toContain('Not becoming: Someone who only works');
    expect(rendered).toContain('- No work past 9pm');
  });

  it('omits a compass field the user left blank', () => {
    const rendered = renderLisIdentityCard(baselineContext({ identity }));
    expect(rendered).not.toMatch(/Struggling with:/);
  });

  /**
   * The whole point of the domain: revoke it and the section is gone, not
   * emptied. The gateway simply never populates `identity`.
   */
  it('vanishes entirely when the domain is off', () => {
    const rendered = renderLisIdentityCard(baselineContext());
    expect(rendered).not.toMatch(/MOVING TOWARD|RULES THEY SET/);
  });

  it('renders without a companion profile, and vice versa', () => {
    const factsOnly = renderLisIdentityCard(baselineContext({ identity }));
    expect(factsOnly).toContain('WHAT THEY ARE MOVING TOWARD');
    expect(factsOnly).not.toContain('WHO YOU ARE SPEAKING WITH');

    const voiceOnly = card({ displayName: 'Rovs' });
    expect(voiceOnly).toContain('WHO YOU ARE SPEAKING WITH');
    expect(voiceOnly).not.toContain('WHAT THEY ARE MOVING TOWARD');
  });

  it('carries both halves when both are present', () => {
    const rendered = renderLisIdentityCard(
      baselineContext({ companionProfile: profile({ displayName: 'Rovs' }), identity }),
    );
    expect(rendered).toContain('Call them Rovs.');
    expect(rendered).toContain('Becoming: Someone who finishes what they start.');
  });
});
