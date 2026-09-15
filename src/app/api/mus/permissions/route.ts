import {
  musContextPermissionUpdateSchema,
  musContextPermissionsFromRows,
} from '@kayamo/ai';
import { listMusContextPermissions, setMusContextPermission } from '@kayamo/db';
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

/** Postgres error code or error name only — never a message carrying row data. */
function describeCause(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return error instanceof Error ? error.name : 'unknown';
}

async function authenticatedClient(request: Request) {
  const client = await createServerSupabase(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  return { client, user };
}

export async function GET(request: Request) {
  const { client, user } = await authenticatedClient(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to manage Kai permissions.' },
      { status: 401, headers: noStoreHeaders },
    );
  }
  try {
    const rows = await listMusContextPermissions(client, user.id);
    return NextResponse.json(
      { permissions: musContextPermissionsFromRows(rows) },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    // Log the cause, never the rows. A bare `catch {}` here meant a missing
    // table looked identical to a transient failure, and the whole permission
    // system being absent took a manual REST probe to diagnose.
    console.error(`Kai permission read failed (${describeCause(error)}).`);
    return NextResponse.json(
      { error: 'Kai permissions are unavailable.' },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function PUT(request: Request) {
  const { client, user } = await authenticatedClient(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to manage Kai permissions.' },
      { status: 401, headers: noStoreHeaders },
    );
  }
  const parsed = musContextPermissionUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Kai permission.' },
      { status: 400, headers: noStoreHeaders },
    );
  }
  try {
    await setMusContextPermission(client, {
      userId: user.id,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    });
    const rows = await listMusContextPermissions(client, user.id);
    return NextResponse.json(
      { permissions: musContextPermissionsFromRows(rows) },
      { headers: noStoreHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: 'Kai permission could not be saved.' },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
