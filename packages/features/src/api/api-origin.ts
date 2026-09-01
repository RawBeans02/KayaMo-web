/**
 * Hosted PWA calls same-origin `/api`. The Capacitor WebView has no Next
 * server — bake NEXT_PUBLIC_API_ORIGIN at `pnpm mobile:sync` so search, OCR,
 * and Mus still hit the hosted app (where the provider key lives).
 * Unset origin keeps relative URLs for `pnpm dev:pwa`.
 *
 * Token lookup is injected so this package never imports a Next supabase client.
 */
export type ApiClientConfig = {
  origin?: string;
  getAccessToken: () => Promise<string | null>;
  onUnauthorized?: () => void;
};

export type ApiFetchInit = RequestInit & { timeoutMs?: number };

export type ApiFetchErrorCode = 'timeout' | 'network' | 'unauthorized' | 'rate_limited' | 'http';

export type ApiOriginMode = 'production' | 'development';

/** Hosted desktop origin. Apex `kayamo.fit` 308s here; use www for cookies and API. */
export const KAYAMO_WEB_ORIGIN = 'https://www.kayamo.fit' as const;

/** Deliberately code-reviewed: bearer traffic from a release bundle goes only here. */
export const KAYAMO_PRODUCTION_API_ORIGIN = KAYAMO_WEB_ORIGIN;

export const KAYAMO_PRODUCTION_API_ORIGINS = [
  KAYAMO_WEB_ORIGIN,
  'https://kayamo.ph',
] as const;

export class ApiFetchError extends Error {
  readonly code: ApiFetchErrorCode;
  readonly status: number | null;
  readonly requestId: string;

  constructor(
    message: string,
    init: { code: ApiFetchErrorCode; status?: number | null; requestId: string },
  ) {
    super(message);
    this.name = 'ApiFetchError';
    this.code = init.code;
    this.status = init.status ?? null;
    this.requestId = init.requestId;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;

const state: ApiClientConfig = {
  origin: process.env.NEXT_PUBLIC_API_ORIGIN,
  getAccessToken: async () => null,
};

const runtimeOriginMode: ApiOriginMode =
  process.env.NODE_ENV === 'development' ? 'development' : 'production';

export function configureApiClient(config: Partial<ApiClientConfig>): void {
  if (config.origin !== undefined) {
    state.origin = config.origin.trim()
      ? validateApiOrigin(config.origin, runtimeOriginMode)
      : undefined;
  }
  if (config.getAccessToken) state.getAccessToken = config.getAccessToken;
  if (config.onUnauthorized) state.onUnauthorized = config.onUnauthorized;
}

export function apiUrl(
  path: string,
  origin = state.origin,
  mode = runtimeOriginMode,
): string {
  if (path.startsWith('//')) throw new Error('API path must not be protocol-relative');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = origin?.trim() ? validateApiOrigin(origin, mode) : '';
  return `${base}${normalizedPath}`;
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(16)}`;
}

/** Sends the Supabase access token so hosted API routes work without cookies. */
export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: parentSignal, ...rest } = init;
  const headers = new Headers(rest.headers);
  const requestId = headers.get('x-request-id') ?? newRequestId();
  headers.set('x-request-id', requestId);
  if (!headers.has('Authorization')) {
    const token = await state.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl(path), { ...rest, headers, signal: controller.signal });
    if (response.status === 401) state.onUnauthorized?.();
    return response;
  } catch (error) {
    if (error instanceof ApiFetchError) throw error;
    if (controller.signal.aborted && !parentSignal?.aborted) {
      throw new ApiFetchError('Request timed out.', { code: 'timeout', requestId });
    }
    throw new ApiFetchError('Network error.', { code: 'network', requestId });
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

/**
 * Normalizes an API origin and fails closed before an access token can be sent.
 * Production is pinned to KayaMo's reviewed public origin. Development accepts
 * only loopback or RFC1918 LAN hosts and must be selected explicitly by callers.
 */
export function validateApiOrigin(raw: string, mode: ApiOriginMode): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('API origin must be a valid absolute URL');
  }

  if (url.username || url.password) {
    throw new Error('API origin must not contain credentials');
  }
  if (url.hash) throw new Error('API origin must not contain a fragment');
  if (url.search) throw new Error('API origin must not contain a query');
  if (url.pathname !== '/') throw new Error('API origin must not contain a path');

  const origin = canonicalizeKayamoOrigin(url.origin);

  if (mode === 'production') {
    if (url.protocol !== 'https:' || !isApprovedProductionOrigin(origin)) {
      throw new Error('Release API origin is not an approved KayaMo HTTPS origin');
    }
    return origin;
  }

  if (isApprovedProductionOrigin(origin)) {
    return origin;
  }
  if (!isDevelopmentHost(url.hostname)) {
    throw new Error('Development API origin must be loopback or a private LAN address');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Development API origin must use HTTP or HTTPS');
  }
  return url.origin;
}

function canonicalizeKayamoOrigin(origin: string): string {
  if (origin === 'https://kayamo.fit') return KAYAMO_WEB_ORIGIN;
  return origin;
}

function isApprovedProductionOrigin(
  origin: string,
): origin is (typeof KAYAMO_PRODUCTION_API_ORIGINS)[number] {
  return (KAYAMO_PRODUCTION_API_ORIGINS as readonly string[]).includes(origin);
}

function isDevelopmentHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1') return true;
  const octets = host.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [first, second] = octets;
  if (first === undefined || second === undefined) return false;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
