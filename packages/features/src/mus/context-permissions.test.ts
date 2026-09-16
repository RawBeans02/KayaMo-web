import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApiClient } from '../api/api-origin';
import {
  loadMusContextPermissions,
  updateMusContextPermission,
} from './context-permissions';

afterEach(() => {
  configureApiClient({ origin: '', getAccessToken: async () => null });
  vi.unstubAllGlobals();
});

describe('Lis permission API client', () => {
  it('returns only a validated server permission state', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        permissions: {
          goals_planning: false,
          physical_self: true,
          memory: false,
          faith: false,
          identity: false,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadMusContextPermissions()).resolves.toEqual({
      goals_planning: false,
      physical_self: true,
      memory: false,
      faith: false,
      identity: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/mus/permissions',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('does not claim a permission changed when the server rejects it', async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: 'no' }, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateMusContextPermission('memory', true)).rejects.toThrow(
      'Lis permissions are unavailable.',
    );
  });

  it('rejects malformed server permission states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ permissions: { memory: true } })),
    );
    await expect(loadMusContextPermissions()).rejects.toThrow(
      'Lis permissions are unavailable.',
    );
  });
});
