import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '../env';

/**
 * Refresh the Supabase session on every request. Without this, server-rendered
 * pages would see stale auth state until the next browser visit.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        for (const { name, value } of toSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options as never);
        }
      },
    },
  });

  // Side effect: this refreshes the session cookie if needed.
  const { data } = await supabase.auth.getUser();

  // Protect (app) and (vendor) route groups, plus /authorize. Allow public marketing.
  const url = request.nextUrl;
  const isProtected =
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/keys') ||
    url.pathname.startsWith('/virtual-keys') ||
    url.pathname.startsWith('/settings') ||
    url.pathname.startsWith('/vendor') ||
    url.pathname.startsWith('/authorize');

  if (isProtected && !data.user) {
    const signin = new URL('/auth/signin', request.url);
    signin.searchParams.set('next', url.pathname + url.search);
    return NextResponse.redirect(signin);
  }

  return response;
}
