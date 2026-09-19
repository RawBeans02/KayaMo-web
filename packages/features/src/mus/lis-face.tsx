'use client';

import { musFaceSrc, type MusFace } from './mus-faces';
import { useMusBusy, useMusFace } from './mus-selection';

/**
 * Lis's face. The four expressions in public/botanical/mus-*.webp ship
 * (owner decision, 2026-09-18); this is the one place they are drawn.
 *
 * The image is decorative: the name "Lis" is always beside it, so it carries
 * no alt text and screen readers skip it. `data-mus-face` names the current
 * expression for tests and for anyone reading the DOM.
 *
 * Which face shows is decided by mus-faces.ts, never here: a reply's declared
 * tone and its safety verdict pick the resting face, and "thinking" is derived
 * from the shared busy flag while a reply is in flight. Concern is for the
 * person, never a missed log or an over-target day; those rules live with the
 * mapping and its tests.
 */
export function LisFace({
  size = 40,
  className,
  face,
}: {
  size?: number;
  className?: string;
  /** Override for surfaces that do not follow the thread (defaults to the shared state). */
  face?: MusFace;
}) {
  const busy = useMusBusy();
  const replyFace = useMusFace();
  const shown: MusFace = face ?? (busy ? 'thinking' : replyFace);
  return (
    <img
      src={musFaceSrc(shown)}
      alt=""
      width={size}
      height={size}
      draggable={false}
      data-mus-face={shown}
      className={className}
    />
  );
}
