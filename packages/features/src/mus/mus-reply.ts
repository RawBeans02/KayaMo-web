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
  };
}
