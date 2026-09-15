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

export function musFaceSrc(face: MusFace): string {
  return `/mus-${face}.png`;
}
