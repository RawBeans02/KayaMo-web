/**
 * Scoring helpers for Lis's voice — the two cheap layers.
 *
 * Layer 1 is a bank of robot tells: objective, free, and the things that
 * actually regress. Layer 2 is structural: sentence count, length, whether the
 * reply asks anything, whether it names something from the user's own records.
 * Layer 3 (an LLM judge) lives in judge.ts and only runs in the live tier.
 *
 * Nothing here calls a model. Everything here is a pure function of a string,
 * so a failure points at a specific sentence rather than at a vibe.
 */

export type RobotTell = {
  id: string;
  pattern: RegExp;
  /** Why it reads as a machine, so a failure message teaches rather than scolds. */
  why: string;
};

export const ROBOT_TELLS: readonly RobotTell[] = [
  {
    // Owner rule 2026-09-20: Lis says what is, never what is not. The common
    // shapes of litotes; the persona carries the rule, this catches the slips.
    id: 'litotes',
    pattern:
      /\b(?:not|isn['’]t|wasn['’]t|aren['’]t|weren['’]t)\s+(?:too\s+|so\s+|half\s+|that\s+|entirely\s+|exactly\s+|the\s+)?(?:bad|worst|terrible|awful|un(?:common|usual|reasonable|important|pleasant|likely|kind|helpful|welcome)|nothing|a\s+small\s+thing|without\s+merit)\b|\bno\s+small\s+(?:feat|thing|step|win)\b|\bfar\s+from\s+(?:bad|terrible|the\s+worst)\b/i,
    why: 'says what is not instead of what is',
  },
  {
    id: 'as-an-ai',
    pattern: /\bas an AI\b/i,
    why: 'announces the machine instead of answering',
  },
  {
    id: 'here-are-n',
    pattern: /^\s*(?:Here (?:are|is)|I(?:'ve| have) (?:got|prepared))\b/i,
    why: 'opens like a search result, not like someone talking',
  },
  {
    id: 'numbered-list-in-chat',
    pattern: /^\s*\d+[.)]\s+\S/m,
    why: 'a numbered list in conversation reads as a report',
  },
  {
    id: 'bulleted-list-in-chat',
    pattern: /^\s*[-*•]\s+\S/m,
    why: 'bullets in conversation read as a report',
  },
  {
    id: 'let-me-know',
    pattern: /\blet me know if\b/i,
    why: 'a customer-service sign-off, not a companion',
  },
  {
    id: 'important-to',
    pattern: /\bit(?:'s| is) important to\b/i,
    why: 'lectures instead of relating',
  },
  {
    id: 'remember-imperative',
    pattern: /(?:^|[.!?]\s+)Remember,/,
    why: 'instructs from above',
  },
  {
    id: 'happy-to-help',
    pattern: /\b(?:happy|glad) to (?:help|assist)\b/i,
    why: 'scripted service language',
  },
  {
    id: 'feel-free',
    pattern: /\bfeel free to\b/i,
    why: 'filler politeness that says nothing',
  },
  {
    id: 'delve',
    pattern: /\b(?:delve|dive) into\b/i,
    why: 'a stock LLM verb',
  },
  {
    id: 'assist-you-with',
    pattern: /\bI (?:can|cannot|can't) (?:help|assist) you with\b/i,
    why: 'help-desk framing',
  },
  {
    id: 'apology',
    pattern: /\b(?:I(?:'m| am) sorry|Apologies|I apologi[sz]e|I should ?n(?:'|o)t have)\b/i,
    why: 'apologises instead of simply correcting itself',
  },
  // Lis tends growth; it is not a cartoon bee. The metaphor is a register, not
  // a costume, and a pun is the fastest way to turn warmth into a mascot voice.
  {
    id: 'pollinator-pun',
    pattern: /\b(?:buzz(?:ing|ed)?\s+(?:through|about|by)|un-?bee-?lievable|bee-?autiful|hive\s+of|sweet\s+as\s+honey|busy\s+as\s+a\s+bee)\b/i,
    why: 'a bee pun; the metaphor is a register, not a costume',
  },
];

export type RobotTellHit = { id: string; why: string; excerpt: string };

export function findRobotTells(message: string): RobotTellHit[] {
  const hits: RobotTellHit[] = [];
  for (const tell of ROBOT_TELLS) {
    const found = tell.pattern.exec(message);
    if (found) {
      hits.push({ id: tell.id, why: tell.why, excerpt: found[0].trim().slice(0, 60) });
    }
  }
  return hits;
}

export type VoiceShape = {
  chars: number;
  sentences: number;
  meanSentenceChars: number;
  asksQuestion: boolean;
  /** Second-person density — a reply about the user, not about the assistant. */
  youCount: number;
  iCount: number;
  /** Which supplied record titles the reply actually named. */
  referencedRecords: string[];
};

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

export function measureVoice(message: string, recordTitles: string[] = []): VoiceShape {
  const trimmed = message.trim();
  const sentences = trimmed ? trimmed.split(SENTENCE_SPLIT).filter(Boolean) : [];
  const lower = trimmed.toLowerCase();
  return {
    chars: trimmed.length,
    sentences: sentences.length,
    meanSentenceChars: sentences.length
      ? Math.round(trimmed.length / sentences.length)
      : 0,
    asksQuestion: trimmed.includes('?'),
    youCount: (lower.match(/\byou(?:r|rs|rself)?\b/g) ?? []).length,
    iCount: (lower.match(/\bi(?:'m|'ve|'ll)?\b/g) ?? []).length,
    referencedRecords: recordTitles.filter((title) =>
      lower.includes(title.toLowerCase()),
    ),
  };
}

/**
 * Ranges, never exact values. "It got wordy and listy" is the most common
 * companion-to-robot regression and it is fully measurable; pinning an exact
 * sentence count would just make the suite brittle.
 */
export type VoiceBounds = {
  maxChars?: number;
  maxSentences?: number;
  maxMeanSentenceChars?: number;
  asksQuestion?: boolean;
  minReferencedRecords?: number;
};

export function checkVoiceBounds(shape: VoiceShape, bounds: VoiceBounds): string[] {
  const failures: string[] = [];
  if (bounds.maxChars !== undefined && shape.chars > bounds.maxChars) {
    failures.push(`length ${shape.chars} > ${bounds.maxChars}`);
  }
  if (bounds.maxSentences !== undefined && shape.sentences > bounds.maxSentences) {
    failures.push(`${shape.sentences} sentences > ${bounds.maxSentences}`);
  }
  if (
    bounds.maxMeanSentenceChars !== undefined &&
    shape.meanSentenceChars > bounds.maxMeanSentenceChars
  ) {
    failures.push(
      `mean sentence ${shape.meanSentenceChars} chars > ${bounds.maxMeanSentenceChars}`,
    );
  }
  if (bounds.asksQuestion !== undefined && shape.asksQuestion !== bounds.asksQuestion) {
    failures.push(bounds.asksQuestion ? 'asked nothing' : 'asked a question');
  }
  if (
    bounds.minReferencedRecords !== undefined &&
    shape.referencedRecords.length < bounds.minReferencedRecords
  ) {
    failures.push(
      `named ${shape.referencedRecords.length} supplied records, wanted ${bounds.minReferencedRecords}`,
    );
  }
  return failures;
}


/**
 * Growth language, used sparingly.
 *
 * Lis speaks like something that tends what you are growing — that is a warmth
 * register, not a theme to decorate every reply with. Once per reply is a voice;
 * three times is a greetings card, and it crowds out the concrete thing the
 * person actually needed. Counted rather than banned for that reason.
 */
const GROWTH_WORDS =
  /\b(?:bloom(?:ing|ed|s)?|blossom(?:ing|ed|s)?|flourish(?:ing|ed|es)?|grow(?:th|ing)?|seed(?:ling|s)?|sprout(?:ing|ed|s)?|root(?:ed|s)?|nurtur(?:e|ing|ed)|cultivat(?:e|ing|ed)|garden|pollinat(?:e|ing|ed)|nectar|honey|hive|bee)\b/gi;

export function countGrowthLanguage(message: string): string[] {
  return message.match(GROWTH_WORDS) ?? [];
}

/** More than this in one reply reads as theme, not voice. */
export const GROWTH_LANGUAGE_LIMIT = 2;
