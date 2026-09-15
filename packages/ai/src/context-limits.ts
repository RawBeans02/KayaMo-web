/**
 * One source of truth for how much context may reach the model.
 *
 * These numbers are consumed in two places that must never disagree:
 * `cocoContextSnapshotSchema` (which rejects an oversized snapshot) and
 * `clampCocoContext` (which makes sure one is never built). Before this module
 * existed, no loader applied a limit while the schema enforced one, so a user's
 * twenty-first memory threw an unhandled ZodError inside `routeCoco` and
 * returned a 500 — permanently, for that user, with no diagnosable signal.
 *
 * Storage limits are deliberately larger than prompt limits. A memory is stored
 * at up to 2000 characters because that is what the user wrote; it is projected
 * at 240 because twenty of them at full length is ten thousand tokens of
 * unranked history in front of every single reply.
 */
export const CONTEXT_LIMITS = {
  tasks: 50,
  routines: 30,
  goals: 20,
  memories: 12,
  memoryContentChars: 240,
  confirmedWorkouts: 10,
  exerciseNames: 30,
  scripture: 10,
  selectedIds: 20,
  /**
   * Prior turns replayed to the model. Eight is enough to resolve "that one"
   * and "no, tomorrow" without letting an old tangent outweigh the snapshot.
   */
  historyTurns: 8,
  historyTurnChars: 600,
  /**
   * What the wire will ACCEPT, versus what reaches the model above.
   *
   * The two differ on purpose. A client with a long thread is normal, and
   * rejecting the request because turn nine exists would repeat exactly the bug
   * the memories cap caused: an ordinary user state taking Lis down. So the
   * schema is generous enough to stop abuse and `clampHistory` decides what is
   * actually sent.
   */
  historyTurnsAccepted: 60,
  historyTurnCharsAccepted: 4000,
} as const;

export type ContextLimits = typeof CONTEXT_LIMITS;

/** Cut to `max` characters on a word boundary, never mid-word. */
export function truncateWords(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
