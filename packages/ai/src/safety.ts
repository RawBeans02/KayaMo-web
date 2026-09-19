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
  // Filipino and Taglish. The persona invites Taglish, so the classifier has
  // to read it or the message reaches the model unscreened. This is a bank of
  // common phrasings written from everyday usage, not a clinical vocabulary;
  // a Filipino-speaking reviewer should extend it. "hindi ko na kaya" (I can't
  // take it any more) is deliberately absent: in a food and gym app it is far
  // more often about a workout than about living.
  /\bgusto\s+ko\s+(?:na\s+lang|nang|na)\s+mamatay\b/i,
  /\bmag(?:pa)?pakamatay\b/i,
  /\b(?:ayoko|ayaw\s+ko)\s+na\s+mabuhay\b/i,
  /\bwala\s+nang\s+(?:kwenta|saysay)\s+(?:ang\s+)?buhay\s+ko\b/i,
  /\bgusto\s+ko\s+nang\s+mawala\b/i,
  /\b(?:sasaktan|papatayin)\s+ko\s+(?:ang\s+)?sarili\s+ko\b/i,
];

const MEDICAL_EMERGENCY = [
  /\bchest\s+pain\b/i,
  /\b(?:can'?t|cannot|struggling\s+to)\s+breathe?\b/i,
  /\b(?:overdose[ds]?|seizure|unconscious|passed\s+out)\b/i,
  /\bsevere\s+bleeding\b/i,
  /\bbleeding\s+(?:a\s+lot|badly|heavily)\b/i,
  // Filipino: "hindi/di ako makahinga" (I can't breathe), chest pain.
  /\b(?:hindi|di)\s+ako\s+makahinga\b/i,
  /\b(?:sumasakit|masakit|sobrang\s+sakit)\s+(?:ang|ng)\s+dibdib\b/i,
];

const EATING_DISORDER = [
  // A food-logging app hears "stopped eating rice" and "haven't eaten yet" all
  // day. Both patterns used to fire on those and send a hungry person to a
  // clinician message. They now need totality or a span of days.
  /\bstop(?:ped)?\s+eating\s+(?:altogether|completely|entirely|for\s+(?:\w+\s+)?(?:days?|weeks?))\b/i,
  /\bstarv(?:e|ing)\s+myself\b/i,
  /\bhave?n'?t\s+eaten\s+(?:in|for)\s+(?:\w+\s+)?(?:days?|weeks?)\b/i,
  /\bnot\s+eat(?:ing)?\s+for\s+(?:a\s+few\s+)?days?\b/i,
  /\bpurge\b/i,
  /\bmake\s+myself\s+(?:vomit|throw\s+up)\b/i,
  /\bunder\s+800\s+calories\b/i,
  /\bunder\s+\d{3}\s+calories?\s*(?:a|per|\/)\s*day\b/i,
  // Filipino: days without eating, forcing or repeatedly vomiting after meals.
  /\bilang\s+araw\s+na\s+(?:akong|ako)\s+(?:hindi|di)\s+kumakain\b/i,
  /\b(?:pinipilit|pilit)\s+(?:kong|ko)\s+(?:sumuka|magsuka)\b/i,
  /\bnagsusuka\s+(?:ako\s+)?(?:pagkatapos|after)\s+kumain\b/i,
];

// Intimate partners and household members. The first version knew only the
// former, so "my dad hits me" reached the model.
const ABUSER =
  '(?:partner|boyfriend|girlfriend|husband|wife|bf|gf|dad|father|mom|mum|mother|step(?:dad|father|mom|mother)|brother|sister|uncle|aunt|parents?)';

const ABUSE = [
  new RegExp(`\\b${ABUSER}\\s+(?:hits?|hurts?|beats?|threatens?|threatened|hit|hurt)\\s+me\\b`, 'i'),
  /\b(?:not|is\s*n'?t)\s+safe\s+at\s+home\b/i,
  new RegExp(`\\bafraid\\s+of\\s+(?:my\\s+)?${ABUSER}\\b`, 'i'),
  // Filipino: "sinasaktan ako ng <someone>" (someone hurts me) needs the agent
  // so it stays physical; "binubugbog ako" (I am being beaten) does not.
  /\bsinasaktan\s+ako\s+ng\b/i,
  /\bbinu?bugbog\s+ako\b/i,
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
        "I'm really glad you told me. Please contact local emergency services or a crisis line now, and if you can, stay with someone you trust. Lis cannot provide emergency care.",
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
        'This may need urgent medical help. Contact local emergency services now. Lis cannot diagnose or provide emergency care.',
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
