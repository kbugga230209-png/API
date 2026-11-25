import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

/** Request-scoped Supabase client that reads/writes the auth cookie. */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render: cookies are read-only there.
          // The middleware refreshes the session instead.
        }
      },
    },
  });
}

export async function getSessionUser() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}
