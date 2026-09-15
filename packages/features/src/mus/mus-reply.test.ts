import { describe, expect, it } from 'vitest';
import { musReplyFromApi } from './mus-reply';

const response = {
  message: 'Rest first. We can look at 9pm when you are ready.',
  tone: 'balanced' as const,
  proposals: [],
  citations: [],
  safety: {
    level: 'safe' as const,
    category: 'none' as const,
    allowModel: true,
    showEmergencyPrompt: false,
    message: null,
  },
};

describe('musReplyFromApi', () => {
  it('reads message from the router envelope', () => {
    expect(musReplyFromApi({ source: 'model', response })).toEqual({
      message: response.message,
      source: 'model',
      proposals: [],
      tone: 'balanced',
      safetyLevel: 'safe',
    });
  });

  /**
   * `tone` is required on every model output and used to be dropped here, so it
   * cost tokens on every request and changed nothing. It now reaches the UI.
   */
  it('carries tone and safety level through to the caller', () => {
    const gentle = musReplyFromApi({
      source: 'model',
      response: { ...response, tone: 'gentle' },
    });
    expect(gentle?.tone).toBe('gentle');

    const urgent = musReplyFromApi({
      source: 'safety',
      response: {
        ...response,
        safety: { ...response.safety, level: 'urgent' },
      },
    });
    expect(urgent?.safetyLevel).toBe('urgent');
  });

  it('does not read message off the envelope root', () => {
    const body = { source: 'model', response };
    expect((body as { message?: string }).message).toBeUndefined();
    expect(musReplyFromApi(body)?.message).toBe(response.message);
  });

  it('returns null when the model text is missing', () => {
    expect(musReplyFromApi({ source: 'model', response: { tone: 'balanced' } })).toBeNull();
    expect(musReplyFromApi({ ok: true })).toBeNull();
  });

  it('keeps write proposals for the confirm UI', () => {
    const proposal = {
      proposalId: 'p1',
      action: 'create_task' as const,
      summary: 'Add stretch after work',
      requiresConfirmation: true as const,
      arguments: {
        title: 'Stretch',
        notes: null,
        scheduledFor: '2026-09-01',
        dueAt: null,
      },
    };
    expect(
      musReplyFromApi({
        source: 'model',
        response: { ...response, proposals: [proposal] },
      }),
    ).toMatchObject({
      message: response.message,
      proposals: [proposal],
    });
  });
});
