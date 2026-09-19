import {
  musContextPermissionDomainSchema,
  musContextPermissionsSchema,
  type MusContextPermissionDomain,
  type MusContextPermissions,
} from '@kayamo/ai';
import { z } from 'zod';
import { apiFetch } from '../api/api-origin';

const responseSchema = z.object({ permissions: musContextPermissionsSchema }).strict();

async function parsePermissionResponse(
  response: Response,
): Promise<MusContextPermissions> {
  if (!response.ok) throw new Error('Lis permissions are unavailable.');
  const parsed = responseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new Error('Lis permissions are unavailable.');
  return parsed.data.permissions;
}

export async function loadMusContextPermissions(): Promise<MusContextPermissions> {
  return parsePermissionResponse(
    await apiFetch('/api/mus/permissions', { cache: 'no-store' }),
  );
}

export async function updateMusContextPermission(
  domain: MusContextPermissionDomain,
  allowed: boolean,
): Promise<MusContextPermissions> {
  const safeDomain = musContextPermissionDomainSchema.parse(domain);
  return parsePermissionResponse(
    await apiFetch('/api/mus/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: safeDomain, allowed }),
    }),
  );
}
