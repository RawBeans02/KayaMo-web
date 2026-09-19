import {
  musContextPermissionUpdateSchema,
  musContextPermissionsFromRows,
} from '@kayamo/ai';
import { listMusContextPermissions, setMusContextPermission } from '@kayamo/db';
import { errorCode, json, jsonError, requireUser } from '@/lib/api';

export async function GET(request: Request) {
  const auth = await requireUser(request, 'Sign in to manage Lis permissions.');
  if (!auth.ok) return auth.response;
  const { supabase: client, user } = auth;
  try {
    const rows = await listMusContextPermissions(client, user.id);
    return json({ permissions: musContextPermissionsFromRows(rows) });
  } catch (error) {
    // Log the cause, never the rows. A bare `catch {}` here meant a missing
    // table looked identical to a transient failure, and the whole permission
    // system being absent took a manual REST probe to diagnose.
    console.error(`Lis permission read failed (${errorCode(error)}).`);
    return jsonError(500, 'Lis permissions are unavailable.');
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser(request, 'Sign in to manage Lis permissions.');
  if (!auth.ok) return auth.response;
  const { supabase: client, user } = auth;
  const parsed = musContextPermissionUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(400, 'Invalid Lis permission.');
  }
  try {
    await setMusContextPermission(client, {
      userId: user.id,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    });
    const rows = await listMusContextPermissions(client, user.id);
    return json({ permissions: musContextPermissionsFromRows(rows) });
  } catch {
    return jsonError(500, 'Lis permission could not be saved.');
  }
}
