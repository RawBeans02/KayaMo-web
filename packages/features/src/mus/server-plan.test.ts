import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbClient } from '@kayamo/db';
import type * as AiModule from '@kayamo/ai';

vi.mock('@kayamo/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof AiModule>();
  return { ...actual, completeObject: vi.fn() };
});

import { completeObject } from '@kayamo/ai';
import {
  handleCaptureText,
  handleObserveImage,
  handlePlanDay,
  handleWhatNow,
} from './server-plan';

const client = {} as DbClient;
const DAY = '2026-09-18';

const VALID = {
  planDay: {
    logicalDate: DAY,
    mode: 'standard',
    nowMin: 600,
    energy: null,
    location: null,
    note: null,
    tasks: [],
    blocks: [],
    windows: [],
    gym: null,
    mealsLogged: null,
  },
  whatNow: { logicalDate: DAY, availableMinutes: 30, location: 'home', energy: null, tasks: [] },
  capture: { logicalDate: DAY, text: 'buy rice' },
  observeImage: {
    logicalDate: DAY,
    mediaType: 'image/png',
    imageBase64: Buffer.from(new Uint8Array(64)).toString('base64'),
    caption: null,
    module: 'mus',
  },
} as const;

const HANDLERS = [
  ['handlePlanDay', handlePlanDay, VALID.planDay],
  ['handleWhatNow', handleWhatNow, VALID.whatNow],
  ['handleCaptureText', handleCaptureText, VALID.capture],
  ['handleObserveImage', handleObserveImage, VALID.observeImage],
] as const;

describe('planner handlers meter after parsing', () => {
  beforeEach(() => {
    vi.mocked(completeObject).mockReset();
  });

  // The routes used to reserve one of the day's five allowance slots before the
  // body was even read, so a malformed request cost a slot and returned 400.
  it.each(HANDLERS)('%s does not reserve for a malformed body', async (_name, handler) => {
    const reserveAllowance = vi.fn(async () => ({ ok: true }) as const);
    const result = await handler(client, 'user-1', { nonsense: true }, { reserveAllowance });
    expect(result.status).toBe(400);
    expect(reserveAllowance).not.toHaveBeenCalled();
    expect(completeObject).not.toHaveBeenCalled();
  });

  it.each(HANDLERS)('%s returns the allowance refusal and never calls the model', async (_name, handler, valid) => {
    const reserveAllowance = vi.fn(async () => ({
      ok: false as const,
      status: 429 as const,
      error: 'Your daily AI request allowance is used.',
    }));
    const result = await handler(client, 'user-1', valid, { reserveAllowance });
    expect(reserveAllowance).toHaveBeenCalledTimes(1);
    expect(reserveAllowance).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ status: 429, body: { error: 'Your daily AI request allowance is used.' } });
    expect(completeObject).not.toHaveBeenCalled();
  });

  it('a valid body with no meter still parses and reaches the model', async () => {
    vi.mocked(completeObject).mockRejectedValueOnce(new Error('stop here'));
    const result = await handleCaptureText(client, 'user-1', VALID.capture);
    // Reached completeObject (mocked to throw), so the telemetry fallback ran.
    expect(completeObject).toHaveBeenCalledTimes(1);
    expect(result.status).not.toBe(400);
  });
});
