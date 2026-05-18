/**
 * Centralized environment access. Lazy + Proxy-based so a missing client var
 * only throws when actually USED, not at module load. This keeps a missing
 * env var from killing the entire client bundle and lets us surface a clearer
 * runtime error at the call site.
 *
 * IMPORTANT: NEXT_PUBLIC_* vars are inlined by Next.js at build time. They
 * must be set in the build environment (Vercel env vars for Production), not
 * just at runtime.
 */

function readEnv(name: string): string | undefined {
  // process.env access is intentionally direct so Next.js' build-time inlining works.
  switch (name) {
    case 'NEXT_PUBLIC_SUPABASE_URL':
      return process.env.NEXT_PUBLIC_SUPABASE_URL;
    case 'NEXT_PUBLIC_SUPABASE_ANON_KEY':
      return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    case 'NEXT_PUBLIC_APP_URL':
      return process.env.NEXT_PUBLIC_APP_URL;
    case 'NEXT_PUBLIC_PROXY_URL':
      return process.env.NEXT_PUBLIC_PROXY_URL;
    case 'SUPABASE_SERVICE_ROLE_KEY':
      return process.env.SUPABASE_SERVICE_ROLE_KEY;
    case 'MEK':
      return process.env.MEK;
    default:
      return undefined;
  }
}

function requireEnv(name: string): string {
  const v = readEnv(name);
  if (!v) {
    throw new Error(
      `Missing required env var: ${name}. ` +
        (name.startsWith('NEXT_PUBLIC_')
          ? 'NEXT_PUBLIC_* vars must be set in Vercel for the Production environment, then redeploy.'
          : 'Set this in your hosting provider (Vercel for the web app, Wrangler secret for the Workers proxy).'),
    );
  }
  return v;
}

/**
 * Public env. Access keys via getters so a missing var only throws when read,
 * not at import time.
 */
export const env = {
  get supabaseUrl(): string {
    return requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get appUrl(): string {
    return requireEnv('NEXT_PUBLIC_APP_URL');
  },
  get proxyUrl(): string {
    return requireEnv('NEXT_PUBLIC_PROXY_URL');
  },
};

/** Server-only env access. Do NOT import from client components. */
export function serverEnv() {
  return {
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    appUrl: requireEnv('NEXT_PUBLIC_APP_URL'),
    proxyUrl: requireEnv('NEXT_PUBLIC_PROXY_URL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    mek: requireEnv('MEK'),
  };
}
