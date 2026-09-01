import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiFetchError,
  apiFetch,
  apiUrl,
  configureApiClient,
  KAYAMO_PRODUCTION_API_ORIGIN,
  KAYAMO_WEB_ORIGIN,
  validateApiOrigin,
} from './api-origin';

afterEach(() => {
  configureApiClient({ origin: '', getAccessToken: async () => null });
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('apiFetch', () => {
  it('sends a request id and bearer token', async () => {
    configureApiClient({ getAccessToken: async () => 'tok' });
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/api/profile');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get('x-request-id')).toMatch(/./);
  });

  it('times out hanging requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      }),
    );
    await expect(apiFetch('/api/slow', { timeoutMs: 20 })).rejects.toBeInstanceOf(ApiFetchError);
  });
});

describe('validateApiOrigin', () => {
  it('prefixes the hosted origin and strips a trailing slash', () => {
    expect(apiUrl('/api/foods/ocr', `${KAYAMO_WEB_ORIGIN}/`)).toBe(
      `${KAYAMO_WEB_ORIGIN}/api/foods/ocr`,
    );
  });

  it('rejects protocol-relative API paths', () => {
    expect(() => apiUrl('//evil.example/steal')).toThrow(/protocol-relative/);
  });

  it('accepts and normalizes the approved production origin', () => {
    expect(validateApiOrigin(`${KAYAMO_WEB_ORIGIN}/`, 'production')).toBe(
      KAYAMO_PRODUCTION_API_ORIGIN,
    );
  });

  it('canonicalizes apex kayamo.fit to www', () => {
    expect(validateApiOrigin('https://kayamo.fit', 'production')).toBe(KAYAMO_WEB_ORIGIN);
  });

  it('still accepts the PWA origin', () => {
    expect(validateApiOrigin('https://kayamo.ph/', 'production')).toBe('https://kayamo.ph');
  });

  it.each([
    'http://kayamo.ph',
    'https://evil.example',
    'https://user:password@kayamo.ph',
    'not a URL',
    'http://localhost:3000',
    'http://192.168.1.20:3000',
  ])('rejects an unsafe release origin %s', (origin) => {
    expect(() => validateApiOrigin(origin, 'production')).toThrow();
  });

  it.each([
    'https://www.kayamo.fit/#fragment',
    'https://www.kayamo.fit/?query=yes',
    'https://www.kayamo.fit/api',
  ])('rejects non-origin URL components %s', (origin) => {
    expect(() => validateApiOrigin(origin, 'production')).toThrow();
  });

  it.each([
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://127.0.0.1:3000', 'http://127.0.0.1:3000'],
    ['http://10.0.2.2:3000/', 'http://10.0.2.2:3000'],
    ['http://192.168.1.20:3000', 'http://192.168.1.20:3000'],
  ])(
    'accepts explicit development origin %s only in development mode',
    (origin, expected) => {
      expect(validateApiOrigin(origin, 'development')).toBe(expected);
      expect(() => validateApiOrigin(origin, 'production')).toThrow();
    },
  );
});
