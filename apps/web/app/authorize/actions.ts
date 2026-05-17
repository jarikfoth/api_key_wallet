'use server';

import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import { generateAuthorizationCode } from '@/lib/keys';
import {
  getVendorAppByClientId,
  createOAuthAuthorization,
  logAudit,
  type Provider,
} from '@akw/db';
import { parseScopes, isRedirectUriAllowed } from '@/lib/oauth';

export async function approveAuthorizationAction(args: {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string | null;
}): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  if (args.codeChallengeMethod !== 'S256') {
    return { ok: false, error: 'Only PKCE S256 is supported' };
  }

  const service = getServiceSupabase();
  const vendor = await getVendorAppByClientId(service, args.clientId);
  if (!vendor || !vendor.approved_at) {
    return { ok: false, error: 'Invalid vendor' };
  }
  if (!isRedirectUriAllowed(args.redirectUri, vendor.redirect_uris)) {
    return { ok: false, error: 'Invalid redirect URI' };
  }

  const scopeResult = parseScopes(args.scope, vendor.allowed_scopes);
  if (!scopeResult.ok) {
    return { ok: false, error: `Invalid scopes: ${scopeResult.invalid.join(', ')}` };
  }
  const scopes: Provider[] = scopeResult.scopes;

  // Issue authorization code (60s expiry, single use)
  const code = generateAuthorizationCode();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  await createOAuthAuthorization(service, {
    vendor_app_id: vendor.id,
    user_id: user.id,
    code,
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: args.redirectUri,
    scopes,
    state: args.state,
    virtual_key_ids: null,
    expires_at: expiresAt,
  });
  await logAudit(service, {
    user_id: user.id,
    action: 'oauth.authorize.approved',
    metadata: { vendor_app_id: vendor.id, scopes },
  });

  const redirect = new URL(args.redirectUri);
  redirect.searchParams.set('code', code);
  if (args.state) redirect.searchParams.set('state', args.state);
  return { ok: true, redirectTo: redirect.toString() };
}
