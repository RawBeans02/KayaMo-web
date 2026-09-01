import { cookies } from 'next/headers';
import { createBearerSupabase, createCookieSupabase } from '@kayamo/db';

function bearerToken(request?: Request): string | null {
  const header = request?.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function createServerSupabase(request?: Request) {
  const token = bearerToken(request);
  if (token) return createBearerSupabase(token);

  const cookieStore = await cookies();
  return createCookieSupabase({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      try {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Called from a Server Component where cookies are read-only.
      }
    },
  });
}
