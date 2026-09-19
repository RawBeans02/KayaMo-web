export const MUS_FACES = ['neutral', 'thinking', 'happy', 'concerned'] as const;
export type MusFace = (typeof MUS_FACES)[number];

export type MusFaceTrigger =
  | { kind: 'idle' }
  | { kind: 'thinking' }
  | { kind: 'chosen_milestone' }
  | { kind: 'wellbeing_concern' }
  | { kind: 'missed_log' }
  | { kind: 'over_target' }
  | { kind: 'gap' };

export const MUS_FACE_RULES: Record<MusFace, string> = {
  neutral: 'Default. Waiting, or anything that is not a chosen milestone or a wellbeing concern.',
  thinking: 'Lis is working on a reply.',
  happy: 'A milestone the user chose. Never for compliance.',
  concerned:
    'Concern for the user, not disappointment at the user. Never a missed log, an over-target day, or a gap.',
};

export function musFaceFor(trigger: MusFaceTrigger): MusFace {
  switch (trigger.kind) {
    case 'thinking':
      return 'thinking';
    case 'chosen_milestone':
      return 'happy';
    case 'wellbeing_concern':
      return 'concerned';
    case 'missed_log':
    case 'over_target':
    case 'gap':
    case 'idle':
      return 'neutral';
  }
}

/**
 * Map a reply's declared tone, plus its safety verdict, onto an expression.
 *
 * `tone` is a REQUIRED field on every model output and, for a long time, was
 * read by nothing — `musReplyFromApi` dropped it on the floor. It cost tokens
 * on every request and changed nothing. This is its reader: Lis has a register,
 * and since 2026-09-19 the register shows on her face (LisFace).
 *
 * Safety outranks tone. A crisis reply is concern for the person, never a
 * neutral acknowledgement, whatever the model happened to declare.
 */
export function musFaceForReply(input: {
  tone?: 'gentle' | 'balanced' | 'firm' | null;
  safetyLevel?: 'safe' | 'supportive_redirect' | 'urgent' | null;
}): MusFace {
  if (input.safetyLevel && input.safetyLevel !== 'safe') return 'concerned';
  return input.tone === 'gentle' ? 'concerned' : 'neutral';
}

/** The shipped expressions: transparent WebP under public/botanical. */
export function musFaceSrc(face: MusFace): string {
  return `/botanical/mus-${face}.webp`;
}
