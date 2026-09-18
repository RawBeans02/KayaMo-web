import { describe, expect, it, vi } from 'vitest';
import { worldwideSearchResponse } from './worldwide-search-server';
const request = (query: unknown = 'tofu') => new Request('http://localhost/api/foods/worldwide', {
  method: 'POST', body: JSON.stringify({ query }), headers: { 'Content-Type': 'application/json' },
});
describe('worldwide food boundary', () => {
  it.each([null, 'guest-local'])('does not search for unauthenticated or guest id %s', async (id) => {
    const search = vi.fn();
    const response = await worldwideSearchResponse(request(), { getUserId: async () => id, search });
    expect(response.status).toBe(401); expect(search).not.toHaveBeenCalled();
  });
  it.each(['', 'x'.repeat(201), 123])('validates input before calling providers', async (query) => {
    const search = vi.fn();
    const response = await worldwideSearchResponse(request(query), { getUserId: async () => 'user-a', search });
    expect(response.status).toBe(400); expect(search).not.toHaveBeenCalled();
  });
  it('returns provider results without exposing account details and prevents HTTP caching', async () => {
    const search = vi.fn(async () => []);
    const response = await worldwideSearchResponse(request('豆腐'), { getUserId: async () => 'user-a', search });
    expect(search).toHaveBeenCalledWith('豆腐');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ foods: [] });
  });
  it('never echoes provider errors or credentials', async () => {
    const response = await worldwideSearchResponse(request(), {
      getUserId: async () => 'user-a',
      search: async () => { throw new Error('private upstream details'); },
    });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private upstream details');
  });
});
