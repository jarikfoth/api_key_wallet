import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { generateDEK, sealToBase64, wrapDEK, loadMEK } from '@akw/crypto';
import { serverEnv } from '@/lib/env';

/**
 * Auth callback handler.
 *
 * - Exchanges the OAuth/magic-link code for a session.
 * - On first sign-in, lazily provisions the user's DEK (wrapped by MEK) so the
 *   rest of the app can encrypt root keys immediately.
 * - Redirects to the requested `next` URL (default: /dashboard).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    const signin = new URL('/auth/signin', request.url);
    signin.searchParams.set('error', error?.message ?? 'auth_failed');
    return NextResponse.redirect(signin);
  }

  // Provision DEK on first sign-in.
  const service = getServiceSupabase();
  const { data: existing } = await service
    .from('user_dek')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (!existing) {
    const { mek: mekB64 } = serverEnv();
    const mek = loadMEK(mekB64);
    const dek = generateDEK();
    const wrapped = await wrapDEK(dek, mek);
    const wrappedB64 = sealToBase64(wrapped);
    await service.from('user_dek').insert({
      user_id: data.user.id,
      wrapped_dek: wrappedB64.ciphertext,
      dek_nonce: wrappedB64.nonce,
    });
  }

  return NextResponse.redirect(new URL(next, request.url));
}
