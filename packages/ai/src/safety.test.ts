import { describe, expect, it } from 'vitest';
import { evaluateCocoSafety, normaliseForSafety } from './safety';

const PH = { timezone: 'Asia/Manila' } as const;

describe('evaluateCocoSafety', () => {
  it.each([
    ['I want to kill myself', 'self_harm', 'urgent'],
    ["I can't breathe and have chest pain", 'medical_emergency', 'urgent'],
    ['My partner hits me and I am scared', 'abuse', 'urgent'],
    ['Help me starve myself this week', 'eating_disorder', 'supportive_redirect'],
  ] as const)('classifies %s', (message, category, level) => {
    const result = evaluateCocoSafety(message, PH);
    expect(result.category).toBe(category);
    expect(result.level).toBe(level);
    expect(result.allowModel).toBe(false);
    expect(result.message).toContain('1553');
    expect(result.message).toContain('NCMH');
  });

  it('allows an ordinary planning message', () => {
    expect(evaluateCocoSafety('Help me plan my morning', PH)).toEqual({
      level: 'safe',
      category: 'none',
      allowModel: true,
      showEmergencyPrompt: false,
      message: null,
    });
  });

  /**
   * Regression table from the 2026-09-15 QA. Every row below was a MISS before
   * apostrophe folding and the added phrasings — seven of ten realistic crisis
   * messages reached the model instead of the deterministic response.
   */
  describe('phrasings a real person types', () => {
    it.each([
      ['i dont want to be alive anymore', 'self_harm'],
      ['i dont want to live', 'self_harm'],
      ['i dont wanna be here', 'self_harm'],
      ['i want to kms', 'self_harm'],
      ['thinking about ending it', 'self_harm'],
      ['i dont see the point of living', 'self_harm'],
      ['i cant breathe', 'medical_emergency'],
      ['my bf hits me', 'abuse'],
      ['i havent eaten in 3 days', 'eating_disorder'],
    ] as const)('catches %s', (message, category) => {
      const result = evaluateCocoSafety(message, PH);
      expect(result.category).toBe(category);
      expect(result.allowModel).toBe(false);
    });
  });

  /**
   * iOS and Android smart punctuation substitute U+2019 by default, so this is
   * how the majority of phone messages are actually shaped.
   */
  describe('curly apostrophes from phone keyboards', () => {
    it.each([
      ['i can’t breathe', 'medical_emergency'],
      ['i don’t want to live', 'self_harm'],
      ['i don’t want to be here', 'self_harm'],
    ] as const)('catches %s', (message, category) => {
      expect(evaluateCocoSafety(message, PH).category).toBe(category);
    });

    it('treats curly and straight apostrophes identically', () => {
      const curly = evaluateCocoSafety('i can’t breathe', PH);
      const straight = evaluateCocoSafety("i can't breathe", PH);
      expect(curly).toEqual(straight);
    });
  });

  describe('support footer follows the profile region', () => {
    it('gives Philippine hotlines to a Manila profile', () => {
      const result = evaluateCocoSafety('i want to kill myself', PH);
      expect(result.message).toContain('1553');
      expect(result.message).toContain('Philippine support');
    });

    it('gives a region-neutral line to a profile outside PH', () => {
      const result = evaluateCocoSafety('i want to kill myself', {
        timezone: 'Europe/Berlin',
      });
      expect(result.message).toContain('local emergency number');
      expect(result.message).not.toContain('1553');
      expect(result.message).not.toContain('NCMH');
    });

    it('does not guess a country when the timezone is unknown', () => {
      const result = evaluateCocoSafety('i want to kill myself');
      expect(result.message).not.toContain('1553');
    });
  });

  describe('the assistant is named Lis everywhere', () => {
    it.each([
      ['i want to kill myself'],
      ['i cant breathe'],
    ] as const)('never says Mus or Coco for %s', (message) => {
      const result = evaluateCocoSafety(message, PH);
      expect(result.message).toContain('Lis');
      expect(result.message).not.toMatch(/\b(?:Mus|Coco)\b/);
    });
  });

  describe('ordinary messages stay out of the crisis path', () => {
    it.each([
      ['i want to end my workout early'],
      ['i cant decide what to cook'],
      ['my boss threatens me with deadlines'],
      ['a 200 calorie snack please'],
    ] as const)('allows %s', (message) => {
      expect(evaluateCocoSafety(message, PH).allowModel).toBe(true);
    });
  });

  /**
   * A food-logging app hears about eating all day. These are the ordinary
   * sentences that the first version of the classifier sent to a clinician
   * message: no duration, no intent, just someone describing a meal.
   */
  describe('ordinary talk about eating is not a red flag', () => {
    it.each([
      ['i havent eaten yet, what should i have for lunch'],
      ["haven't eaten breakfast yet"],
      ['i stopped eating rice this week'],
      ['i stopped eating after 8pm'],
      ['stopped eating so much sugar'],
      ['i havent eaten anything sweet today'],
    ] as const)('allows %s', (message) => {
      expect(evaluateCocoSafety(message, PH).allowModel).toBe(true);
    });

    it.each([
      ['i havent eaten for a week'],
      ['havent eaten in days'],
      ['i stopped eating altogether'],
      ['stopped eating completely'],
      ['i stopped eating for three days'],
    ] as const)('still catches %s', (message) => {
      expect(evaluateCocoSafety(message, PH).category).toBe('eating_disorder');
    });
  });

  /**
   * Household and family abuse. The first version only knew intimate partners.
   */
  describe('abuse is not only from a partner', () => {
    it.each([
      ['my dad hits me'],
      ['my mother beats me'],
      ['my stepdad hurts me'],
      ['my brother threatens me'],
    ] as const)('catches %s', (message) => {
      const result = evaluateCocoSafety(message, PH);
      expect(result.category).toBe('abuse');
      expect(result.allowModel).toBe(false);
    });
  });

  /**
   * The persona invites Taglish, so the classifier has to read it. Written from
   * common phrasings, not a clinical vocabulary; a Filipino-speaking reviewer
   * should extend this table.
   */
  describe('Filipino and Taglish crisis phrasings', () => {
    it.each([
      ['gusto ko na lang mamatay', 'self_harm'],
      ['magpapakamatay na ako', 'self_harm'],
      ['gusto kong magpakamatay', 'self_harm'],
      ['ayoko na mabuhay', 'self_harm'],
      ['ayaw ko na mabuhay', 'self_harm'],
      ['wala nang kwenta ang buhay ko', 'self_harm'],
      ['gusto ko nang mawala', 'self_harm'],
      ['sasaktan ko ang sarili ko', 'self_harm'],
      ['hindi ako makahinga', 'medical_emergency'],
      ['di ako makahinga', 'medical_emergency'],
      ['sumasakit ang dibdib ko', 'medical_emergency'],
      ['sinasaktan ako ng asawa ko', 'abuse'],
      ['sinasaktan ako ng nobyo ko', 'abuse'],
      ['binubugbog ako ng partner ko', 'abuse'],
      ['ilang araw na akong hindi kumakain', 'eating_disorder'],
      ['pinipilit kong sumuka pagkatapos kumain', 'eating_disorder'],
      ['nagsusuka ako pagkatapos kumain', 'eating_disorder'],
    ] as const)('catches %s', (message, category) => {
      const result = evaluateCocoSafety(message, PH);
      expect(result.category).toBe(category);
      expect(result.allowModel).toBe(false);
    });

    it.each([
      ['hindi ko na kaya yung workout na to'],
      ['ayoko na ng kanin ngayon'],
      ['gusto ko ng adobo mamaya'],
      ['hindi ako kumain ng almusal'],
    ] as const)('allows ordinary Taglish %s', (message) => {
      expect(evaluateCocoSafety(message, PH).allowModel).toBe(true);
    });
  });
});

describe('normaliseForSafety', () => {
  it('folds every apostrophe variant to the straight form', () => {
    expect(normaliseForSafety('don’t don‘t donʼt don`t')).toBe(
      "don't don't don't don't",
    );
  });

  it('collapses runs of whitespace', () => {
    expect(normaliseForSafety('  i   cant \n breathe  ')).toBe('i cant breathe');
  });
});
