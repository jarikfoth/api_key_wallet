import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client — bypasses RLS. ONLY use server-side
 * (Next.js server actions / route handlers, Cloudflare Workers).
 * NEVER expose the service role key to the browser.
 */
export function createServiceClient(opts: {
  url: string;
  serviceRoleKey: string;
}): SupabaseClient {
  return createClient(opts.url, opts.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Anon client — RLS-respecting. Use in browser code or server code
 * that should act with the user's permissions.
 */
export function createAnonClient(opts: { url: string; anonKey: string }): SupabaseClient {
  return createClient(opts.url, opts.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
