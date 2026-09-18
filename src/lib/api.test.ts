import { describe, expect, it } from 'vitest';
import { NO_STORE, errorCode, json, jsonError, requireUser } from './api';

type Client = Parameters<typeof requireUser>[2] extends (r: Request) => Promise<infer C> ? C : never;

function clientWithUser(user: { id: string } | null): (r: Request) => Promise<Client> {
  return async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) as unknown as Client;
}

describe('route kit', () => {
  it('json responses are private and never stored', async () => {
    const res = json({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(NO_STORE['Cache-Control']);
    expect(await res.json()).toEqual({ a: 1 });
  });

  it('jsonError carries the status and the message', async () => {
    const res = jsonError(400, 'Invalid request.');
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(await res.json()).toEqual({ error: 'Invalid request.' });
  });

  it('requireUser returns the 401 when nobody is signed in', async () => {
    const result = await requireUser(new Request('http://x/api'), 'Sign in first.', clientWithUser(null));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.response.status).toBe(401);
    expect(result.response.headers.get('cache-control')).toContain('no-store');
    expect(await result.response.json()).toEqual({ error: 'Sign in first.' });
  });

  it('requireUser hands back the client and the user when signed in', async () => {
    const result = await requireUser(new Request('http://x/api'), 'Sign in first.', clientWithUser({ id: 'u-1' }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a user');
    expect(result.user.id).toBe('u-1');
  });

  it('errorCode never returns a message', () => {
    expect(errorCode({ code: 'PGRST205', message: 'row 42 kcal 900' })).toBe('PGRST205');
    expect(errorCode(new TypeError('secret'))).toBe('TypeError');
    expect(errorCode('nope')).toBe('unknown');
  });
});
