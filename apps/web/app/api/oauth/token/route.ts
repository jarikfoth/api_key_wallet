import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sha256Hex } from '@akw/crypto';
import {
  consumeOAuthAuthorization,
  getVendorAppByClientId,
  getRootKeyByProvider,
  createVirtualKey,
  logAudit,
  type Provider,
} from '@akw/db';
import { generateVirtualKey } from '@/lib/keys';
import { verifyPkce } from '@/lib/oauth';
import { getServiceSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';

const bodySchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  redirect_uri: z.string().url(),
});

function err(status: number, error: string, description?: string) {
  return NextResponse.json({ error, error_description: description }, { status });
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  const contentType = req.headers.get('content-type') ?? '';
  try {
    raw = contentType.includes('application/json')
      ? await req.json()
      : Object.fromEntries(await req.formData());
  } catch {
    return err(400, 'invalid_request', 'Could not parse request body');
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return err(400, 'invalid_request', parsed.error.issues[0]?.message);
  }
  const body = parsed.data;

  const service = getServiceSupabase();
  const vendor = await getVendorAppByClientId(service, body.client_id);
  if (!vendor || !vendor.approved_at) return err(401, 'invalid_client');

  const givenSecretHash = await sha256Hex(body.client_secret);
  if (givenSecretHash !== vendor.client_secret_hash) return err(401, 'invalid_client');

  const authz = await consumeOAuthAuthorization(service, body.code);
  if (!authz) return err(400, 'invalid_grant', 'Code expired, already used, or unknown');

  if (authz.vendor_app_id !== vendor.id) return err(400, 'invalid_grant', 'Code/client mismatch');
  if (authz.redirect_uri !== body.redirect_uri)
    return err(400, 'invalid_grant', 'Redirect URI mismatch');

  const pkceOk = await verifyPkce(body.code_verifier, authz.code_challenge);
  if (!pkceOk) return err(400, 'invalid_grant', 'PKCE verifier mismatch');

  // Mint virtual keys for each scope, tied to (user, vendor, root_key for provider).
  const keys: Record<string, string> = {};
  const mintedIds: string[] = [];
  for (const scope of authz.scopes as Provider[]) {
    const root = await getRootKeyByProvider(service, authz.user_id, scope);
    if (!root) {
      return err(
        400,
        'invalid_grant',
        `User has no root key for scope ${scope} — they need to add one and re-authorize.`,
      );
    }
    const newKey = await generateVirtualKey(scope);
    const inserted = await createVirtualKey(service, {
      user_id: authz.user_id,
      root_key_id: root.id,
      vendor_app_id: vendor.id,
      provider: scope,
      prefix: newKey.prefix,
      key_hash: newKey.hash,
      label: vendor.name,
      model_allowlist: null,
      budget_cents_per_month: null,
    });
    keys[scope] = newKey.full;
    mintedIds.push(inserted.id);
  }

  // Record the minted IDs on the authorization for the audit trail.
  await service
    .from('oauth_authorizations')
    .update({ virtual_key_ids: mintedIds })
    .eq('id', authz.id);

  await logAudit(service, {
    user_id: authz.user_id,
    action: 'oauth.token.exchanged',
    metadata: { vendor_app_id: vendor.id, scopes: authz.scopes, minted_ids: mintedIds },
  });

  return NextResponse.json({
    keys,
    base_url: env.proxyUrl,
    user_id: authz.user_id, // opaque to the vendor; useful for their own correlation
  });
}
