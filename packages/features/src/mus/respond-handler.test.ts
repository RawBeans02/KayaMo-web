import { describe, expect, it, vi } from 'vitest';
import type { CocoProvider, CocoTelemetryEvent } from '@kayamo/ai';
import { handleMusRespond, type AllowanceOutcome, type MusRespondDeps } from './respond-handler';

/**
 * These tests exist for one reason: the 2026-09-15 QA found that a user in
 * crisis received "Your AI request allowance is used for today" instead of a
 * crisis line, because the quota gate ran before the safety classifier. The
 * ordering is now a property this file asserts rather than something you have
 * to read the route to know.
 */

const VALID_BODY = {
  requestId: 'req-1',
  mode: 'chat' as const,
  message: 'help me plan my morning',
  logicalDate: '2026-08-22',
};

function provider(): CocoProvider & { calls: number } {
  const fake = {
    calls: 0,
    generate: async () => {
      fake.calls += 1;
      return {
        output: {
          message: 'Here is one step.',
          tone: 'balanced' as const,
          proposals: [],
          citations: [],
        },
        model: 'fake-model',
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.001,
      };
    },
  };
  return fake;
}

/** Minimal Supabase double: every loader fails, so the context is empty. */
const failingClient = {
  from: () => {
    throw new Error('no database in this test');
  },
  rpc: () => {
    throw new Error('no database in this test');
  },
} as unknown as MusRespondDeps['client'];

function emptyContext() {
  return {
    version: 1 as const,
    logicalDate: '2026-08-22',
    timezone: 'Asia/Manila',
    recommendedAction: {
      kind: 'check_in' as const,
      recordId: null,
      title: 'Choose what would help next',
    },
    tasks: [],
    routines: [],
    goals: [],
    health: { mealsLogged: 0, weightLogged: false, workoutStatus: 'none' as const },
    memories: [],
    permissions: {
      goals_planning: false,
      physical_self: false,
      memory: false,
      faith: false,
    },
  };
}

function emptyAudit() {
  return {
    requestedDomains: [],
    grantedDomains: [],
    omittedDomains: [],
    permissionLookupFailed: false,
    domainLoadFailures: [],
    truncatedDomains: [],
  };
}

function deps(overrides: Partial<MusRespondDeps> = {}): MusRespondDeps & {
  reserve: ReturnType<typeof vi.fn>;
} {
  const reserve = vi.fn(async (): Promise<AllowanceOutcome> => ({ ok: true }));
  return {
    client: failingClient,
    userId: 'user-1',
    body: VALID_BODY,
    provider: provider(),
    reserveAllowance: reserve,
    spentUsd: async () => 0,
    readTimezone: async () => 'Asia/Manila',
    buildContext: async () => ({ context: emptyContext(), audit: emptyAudit() }),
    config: { maxRetries: 0 },
    reserve,
    ...overrides,
  } as MusRespondDeps & { reserve: ReturnType<typeof vi.fn> };
}

describe('handleMusRespond ordering', () => {
  it('answers a crisis message without spending an AI request', async () => {
    const d = deps({ body: { ...VALID_BODY, message: 'i dont want to be alive anymore' } });

    const result = await handleMusRespond(d);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ source: 'safety' });
    expect(d.reserveAllowance).not.toHaveBeenCalled();
    expect((d.provider as ReturnType<typeof provider>).calls).toBe(0);
  });

  it('answers a crisis message even when the allowance is exhausted', async () => {
    const exhausted = vi.fn(
      async (): Promise<AllowanceOutcome> => ({
        ok: false,
        status: 429,
        error: 'Your daily AI request allowance is used.',
      }),
    );
    const d = deps({
      body: { ...VALID_BODY, message: 'i cant breathe' },
      reserveAllowance: exhausted,
    });

    const result = await handleMusRespond(d);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ source: 'safety' });
    const body = result.body as { response: { message: string } };
    expect(body.response.message).not.toMatch(/allowance/i);
    expect(body.response.message).toContain('1553');
  });

  it('rejects a malformed body without spending an AI request', async () => {
    const d = deps({ body: { garbage: true } });

    const result = await handleMusRespond(d);

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'Invalid Lis request.' });
    expect(d.reserveAllowance).not.toHaveBeenCalled();
  });

  it.each([
    ['not an object at all', 'a string body'],
    ['null', null],
  ])('rejects %s with 400, not 429', async (_label, body) => {
    const d = deps({ body });
    const result = await handleMusRespond(d);
    expect(result.status).toBe(400);
    expect(d.reserveAllowance).not.toHaveBeenCalled();
  });

  it('surfaces an exhausted allowance for an ordinary message', async () => {
    const exhausted = vi.fn(
      async (): Promise<AllowanceOutcome> => ({
        ok: false,
        status: 429,
        error: 'Your daily AI request allowance is used. It resets at 00:00 UTC.',
      }),
    );
    const d = deps({ reserveAllowance: exhausted });

    const result = await handleMusRespond(d);

    expect(result.status).toBe(429);
    expect(result.body).toMatchObject({ error: expect.stringContaining('00:00 UTC') });
    expect((d.provider as ReturnType<typeof provider>).calls).toBe(0);
  });

  it('reserves exactly one request for an ordinary message', async () => {
    const d = deps();
    const result = await handleMusRespond(d);
    expect(result.status).toBe(200);
    expect(d.reserveAllowance).toHaveBeenCalledTimes(1);
  });
});

describe('handleMusRespond crisis telemetry', () => {
  it('records the deterministic safety turn without provider cost', async () => {
    const events: CocoTelemetryEvent[] = [];
    const d = deps({
      body: { ...VALID_BODY, message: 'i want to kill myself' },
      telemetry: { record: async (event) => void events.push(event) },
    });

    await handleMusRespond(d);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      model: 'deterministic-safety',
      outcome: 'safety',
      costUsd: 0,
      inputTokens: 0,
    });
  });

  it('never lets a telemetry failure break a crisis reply', async () => {
    const d = deps({
      body: { ...VALID_BODY, message: 'i want to kill myself' },
      telemetry: {
        record: async () => {
          throw new Error('telemetry down');
        },
      },
    });

    const result = await handleMusRespond(d);
    expect(result.body).toMatchObject({ source: 'safety' });
  });
});

describe('handleMusRespond crisis region', () => {
  it('uses the profile timezone to pick the support line', async () => {
    const ph = await handleMusRespond(
      deps({ body: { ...VALID_BODY, message: 'i cant breathe' } }),
    );
    const abroad = await handleMusRespond(
      deps({
        body: { ...VALID_BODY, message: 'i cant breathe' },
        readTimezone: async () => 'Europe/Berlin',
      }),
    );

    const phMessage = (ph.body as { response: { message: string } }).response.message;
    const abroadMessage = (abroad.body as { response: { message: string } }).response
      .message;
    expect(phMessage).toContain('1553');
    expect(abroadMessage).not.toContain('1553');
    expect(abroadMessage).toContain('local emergency number');
  });

  it('still answers when the timezone lookup fails', async () => {
    const result = await handleMusRespond(
      deps({
        body: { ...VALID_BODY, message: 'i cant breathe' },
        readTimezone: async () => {
          throw new Error('profile unavailable');
        },
      }),
    );
    expect(result.body).toMatchObject({ source: 'safety' });
  });
});
