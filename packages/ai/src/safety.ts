import type { CocoSafetyResult } from './contracts';
import {
  formatSupportFooter,
  supportRegionFromTimezone,
  type SupportRegion,
} from './ph-support';

/**
 * Deterministic crisis classifier. Runs before the model, costs nothing, and
 * must never be gated behind a quota or a permission.
 *
 * Every pattern is matched against a NORMALISED copy of the message. Phone
 * keyboards substitute a curly apostrophe (U+2019) for the straight one by
 * default, so a pattern written with `'` silently missed the most common way a
 * message is typed — `i can’t breathe` did not match while `i can't breathe`
 * did. Apostrophes are also optional throughout, because the people most likely
 * to be in crisis are the least likely to punctuate.
 */

/** Curly, modifier, and grave variants all fold to the straight apostrophe. */
const APOSTROPHE_VARIANTS = /[‘’ʼʻ՚`´]/g;

export function normaliseForSafety(message: string): string {
  return message
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const SELF_HARM = [
  /\b(?:kill|hurt|harm)\s+myself\b/i,
  /\bkms\b/i,
  /\bdo(?:n'?t|\s+not)\s+(?:want\s+to|wanna)\s+(?:be\s+(?:here|alive)|live|exist|wake\s+up)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend(?:ing)?\s+(?:my\s+life|it\s+all)\b/i,
  // Scoped to the deliberative phrasing: bare "ending it" is too often a
  // relationship, but "thinking about ending it" in this app is not.
  /\bthinking\s+about\s+ending\s+it\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b/i,
  /\bdo(?:n'?t|\s+not)\s+see\s+(?:the\s+)?point\s+(?:of|in)\s+(?:living|life|going\s+on)\b/i,
  /\bno\s+(?:point|reason)\s+(?:in|to)\s+(?:living|going\s+on)\b/i,
];

const MEDICAL_EMERGENCY = [
  /\bchest\s+pain\b/i,
  /\b(?:can'?t|cannot|struggling\s+to)\s+breathe?\b/i,
  /\b(?:overdose[ds]?|seizure|unconscious|passed\s+out)\b/i,
  /\bsevere\s+bleeding\b/i,
  /\bbleeding\s+(?:a\s+lot|badly|heavily)\b/i,
];

const EATING_DISORDER = [
  /\b(?:stop|stopped)\s+eating\b/i,
  /\bstarv(?:e|ing)\s+myself\b/i,
  /\bhave?n'?t\s+eaten\b/i,
  /\bnot\s+eat(?:ing)?\s+for\s+(?:a\s+few\s+)?days?\b/i,
  /\bpurge\b/i,
  /\bmake\s+myself\s+(?:vomit|throw\s+up)\b/i,
  /\bunder\s+800\s+calories\b/i,
  /\bunder\s+\d{3}\s+calories?\s*(?:a|per|\/)\s*day\b/i,
];

const ABUSE = [
  /\b(?:partner|boyfriend|girlfriend|husband|wife|bf|gf)\s+(?:hits?|hurts?|beats?|threatens?|threatened|hit|hurt)\s+me\b/i,
  /\b(?:not|is\s*n'?t)\s+safe\s+at\s+home\b/i,
  /\bafraid\s+of\s+(?:my\s+)?(?:partner|boyfriend|girlfriend|husband|wife)\b/i,
];

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export type CocoSafetyOptions = {
  /** Profile timezone from the context snapshot; selects the support footer. */
  timezone?: string | null;
};

export function evaluateCocoSafety(
  message: string,
  options: CocoSafetyOptions = {},
): CocoSafetyResult {
  const normalised = normaliseForSafety(message);
  const region: SupportRegion = supportRegionFromTimezone(options.timezone);
  const withSupport = (text: string): string =>
    `${text}\n\n${formatSupportFooter(region)}`;

  if (matchesAny(normalised, SELF_HARM)) {
    return {
      level: 'urgent',
      category: 'self_harm',
      allowModel: false,
      showEmergencyPrompt: true,
      message: withSupport(
        "I'm really glad you told me. Please contact local emergency services or a crisis line now, and if you can, stay with someone you trust. Kai cannot provide emergency care.",
      ),
    };
  }
  if (matchesAny(normalised, MEDICAL_EMERGENCY)) {
    return {
      level: 'urgent',
      category: 'medical_emergency',
      allowModel: false,
      showEmergencyPrompt: true,
      message: withSupport(
        'This may need urgent medical help. Contact local emergency services now. Kai cannot diagnose or provide emergency care.',
      ),
    };
  }
  if (matchesAny(normalised, ABUSE)) {
    return {
      level: 'urgent',
      category: 'abuse',
      allowModel: false,
      showEmergencyPrompt: true,
      message: withSupport(
        'Your safety matters. If you are in immediate danger, contact local emergency services or move to a safer place if you can. Consider reaching out to someone you trust.',
      ),
    };
  }
  if (matchesAny(normalised, EATING_DISORDER)) {
    return {
      level: 'supportive_redirect',
      category: 'eating_disorder',
      allowModel: false,
      showEmergencyPrompt: false,
      message: withSupport(
        "I can't help with starvation, purging, or unsafe restriction. You deserve support that protects your health; consider contacting a qualified clinician or someone you trust.",
      ),
    };
  }
  return {
    level: 'safe',
    category: 'none',
    allowModel: true,
    showEmergencyPrompt: false,
    message: null,
  };
}
