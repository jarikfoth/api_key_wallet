import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@akw/db';
import { env, serverEnv } from '../env';

/**
 * Session-aware Supabase client for use in Server Components, server actions,
 * and Route Handlers. Reads/writes the user's session cookie.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options as never);
          }
        } catch {
          // Server Components cannot set cookies; ignore — middleware handles refresh.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. Use for sensitive writes (encrypting root
 * keys, minting virtual keys, OAuth code issuance) that the user can't do directly.
 */
export function getServiceSupabase() {
  const { supabaseUrl, supabaseServiceRoleKey } = serverEnv();
  return createServiceClient({ url: supabaseUrl, serviceRoleKey: supabaseServiceRoleKey });
}

/**
 * Returns the signed-in user, or null. Use in Server Components.
 */
export async function getCurrentUser() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
