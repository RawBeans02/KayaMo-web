import { cocoResponseSchema, type CocoActionProposal, type CocoRouterResult } from '@kayamo/ai';
import type { LocalCocoMessage } from '@kayamo/offline';

const SOURCES = new Set(['model', 'fallback', 'safety', 'budget']);

function asSource(value: unknown): LocalCocoMessage['response_source'] {
  return typeof value === 'string' && SOURCES.has(value)
    ? (value as NonNullable<LocalCocoMessage['response_source']>)
    : 'fallback';
}

/** /api/mus/respond returns { source, response }, not a flat CocoResponse. */
export function musReplyFromApi(body: unknown): {
  message: string;
  source: LocalCocoMessage['response_source'];
  proposals: CocoActionProposal[];
  tone: 'gentle' | 'balanced' | 'firm' | null;
  safetyLevel: 'safe' | 'supportive_redirect' | 'urgent' | null;
} | null {
  if (!body || typeof body !== 'object') return null;
  const row = body as Partial<CocoRouterResult> & { message?: unknown };
  const nested = cocoResponseSchema.safeParse(row.response);
  const message = nested.success
    ? nested.data.message.trim()
    : typeof row.message === 'string'
      ? row.message.trim()
      : '';
  if (!message) return null;
  return {
    message,
    source: asSource(row.source),
    proposals: nested.success ? nested.data.proposals : [],
    // Carried rather than dropped: `tone` is required on every model output and
    // had no reader, so it was pure cost. See musFaceForReply.
    tone: nested.success ? nested.data.tone : null,
    safetyLevel: nested.success ? nested.data.safety.level : null,
  };
}
