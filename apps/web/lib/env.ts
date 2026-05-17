/**
 * Centralized environment access. Throws early in dev if anything is missing.
 * Public vars (NEXT_PUBLIC_*) are safe in the browser bundle.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  appUrl: requireEnv('NEXT_PUBLIC_APP_URL'),
  proxyUrl: requireEnv('NEXT_PUBLIC_PROXY_URL'),
};

/** Server-only env access. Do NOT import from client components. */
export function serverEnv() {
  return {
    ...env,
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    mek: requireEnv('MEK'),
  };
}
