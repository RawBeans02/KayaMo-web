import { KAYAMO_WEB_ORIGIN } from './api/api-origin';

export type NativePorts = {
  isNativeApp: () => boolean;
  registerPushIfNative?: () => Promise<string | null>;
};

export type AuthRedirectPorts = {
  afterAuthPath: string;
  isNativeApp: () => boolean;
  nativeCallbackUrl: string;
};

function authRedirectOrigin(): string | null {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv === 'https://kayamo.fit' ? KAYAMO_WEB_ORIGIN : fromEnv;
  const vercel = (
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_URL ??
    ''
  )
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  if (vercel) {
    const host = vercel === 'kayamo.fit' ? 'www.kayamo.fit' : vercel;
    return `https://${host}`;
  }
  return process.env.NODE_ENV === 'production' ? KAYAMO_WEB_ORIGIN : null;
}

export function authRedirectTo(ports: AuthRedirectPorts): string {
  if (ports.isNativeApp()) return ports.nativeCallbackUrl;
  const next = ports.afterAuthPath.startsWith('/') ? ports.afterAuthPath : `/${ports.afterAuthPath}`;
  const path = `/auth/callback?next=${encodeURIComponent(next)}`;
  const origin = authRedirectOrigin();
  return origin ? `${origin}${path}` : path;
}
