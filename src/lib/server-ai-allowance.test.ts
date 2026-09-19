import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@kayamo/db/service', () => ({ createServiceSupabase: () => ({ rpc }) }));
import { reserveWebAiRequest } from './server-ai-allowance';

describe('trusted web AI request allowance', () => {
  beforeEach(() => { rpc.mockReset(); vi.unstubAllEnvs(); });
  it('reserves using only the authenticated user and server limit, never a client date', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await reserveWebAiRequest('verified-user')).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('reserve_web_ai_request', { p_user_id: 'verified-user', p_daily_limit: 5 });
  });
  it('rejects exhausted allowances', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const outcome = await reserveWebAiRequest('verified-user');
    expect(outcome).toMatchObject({ ok: false, status: 429 });
    expect(outcome.ok ? '' : outcome.error).toContain('00:00 UTC');
  });
  it.each([null, 'true', 1])('fails closed for malformed RPC response %s', async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    expect(await reserveWebAiRequest('verified-user')).toMatchObject({ ok: false, status: 503 });
  });
  it('fails closed if the migration or service is unavailable', async () => {
    rpc.mockRejectedValue(new Error('unavailable'));
    expect(await reserveWebAiRequest('verified-user')).toMatchObject({ ok: false, status: 503 });
  });
  it('invalid environment values cannot disable the allowance', async () => {
    vi.stubEnv('WEB_AI_DAILY_REQUEST_LIMIT', '0');
    rpc.mockResolvedValue({ data: true, error: null });
    await reserveWebAiRequest('verified-user');
    expect(rpc).toHaveBeenCalledWith('reserve_web_ai_request', { p_user_id: 'verified-user', p_daily_limit: 5 });
  });
});
