import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Provider,
  RootKey,
  VirtualKey,
  VendorApp,
  VendorAppPublic,
  OAuthAuthorization,
  UsageEvent,
  UserDek,
} from './types.js';

/* -----------------------------------------------------------------------------
 * user_dek
 * -------------------------------------------------------------------------- */

export async function getUserDek(
  db: SupabaseClient,
  userId: string,
): Promise<UserDek | null> {
  const { data, error } = await db
    .from('user_dek')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserDek | null;
}

export async function insertUserDek(
  db: SupabaseClient,
  row: { user_id: string; wrapped_dek: string; dek_nonce: string },
): Promise<void> {
  const { error } = await db.from('user_dek').insert(row);
  if (error) throw error;
}

/* -----------------------------------------------------------------------------
 * root_keys
 * -------------------------------------------------------------------------- */

export async function upsertRootKey(
  db: SupabaseClient,
  row: {
    user_id: string;
    provider: Provider;
    encrypted_key: string;
    key_nonce: string;
    label?: string | null;
  },
): Promise<RootKey> {
  const { data, error } = await db
    .from('root_keys')
    .upsert(
      {
        ...row,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as RootKey;
}

export async function listRootKeys(db: SupabaseClient, userId: string): Promise<RootKey[]> {
  const { data, error } = await db
    .from('root_keys')
    .select('*')
    .eq('user_id', userId)
    .order('provider');
  if (error) throw error;
  return (data ?? []) as RootKey[];
}

export async function getRootKey(db: SupabaseClient, id: string): Promise<RootKey | null> {
  const { data, error } = await db.from('root_keys').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as RootKey | null;
}

export async function getRootKeyByProvider(
  db: SupabaseClient,
  userId: string,
  provider: Provider,
): Promise<RootKey | null> {
  const { data, error } = await db
    .from('root_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  if (error) throw error;
  return data as RootKey | null;
}

export async function deleteRootKey(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('root_keys').delete().eq('id', id);
  if (error) throw error;
}

/* -----------------------------------------------------------------------------
 * vendor_apps
 * -------------------------------------------------------------------------- */

export async function createVendorApp(
  db: SupabaseClient,
  row: Omit<VendorApp, 'id' | 'created_at' | 'approved_at'> & { approved_at?: string | null },
): Promise<VendorApp> {
  const { data, error } = await db.from('vendor_apps').insert(row).select('*').single();
  if (error) throw error;
  return data as VendorApp;
}

export async function getVendorAppByClientId(
  db: SupabaseClient,
  clientId: string,
): Promise<VendorApp | null> {
  const { data, error } = await db
    .from('vendor_apps')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return data as VendorApp | null;
}

export async function getPublicVendorAppByClientId(
  db: SupabaseClient,
  clientId: string,
): Promise<VendorAppPublic | null> {
  const { data, error } = await db
    .from('vendor_apps_public')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return data as VendorAppPublic | null;
}

export async function listVendorAppsByOwner(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<VendorApp[]> {
  const { data, error } = await db
    .from('vendor_apps')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as VendorApp[];
}

/* -----------------------------------------------------------------------------
 * virtual_keys
 * -------------------------------------------------------------------------- */

export async function createVirtualKey(
  db: SupabaseClient,
  row: Omit<
    VirtualKey,
    'id' | 'created_at' | 'current_period_spend_cents' | 'current_period_started_at' | 'revoked_at'
  >,
): Promise<VirtualKey> {
  const { data, error } = await db.from('virtual_keys').insert(row).select('*').single();
  if (error) throw error;
  return data as VirtualKey;
}

export async function getVirtualKeyByHash(
  db: SupabaseClient,
  keyHash: string,
): Promise<VirtualKey | null> {
  const { data, error } = await db
    .from('virtual_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .maybeSingle();
  if (error) throw error;
  return data as VirtualKey | null;
}

export async function listVirtualKeys(
  db: SupabaseClient,
  userId: string,
): Promise<VirtualKey[]> {
  const { data, error } = await db
    .from('virtual_keys')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as VirtualKey[];
}

export async function revokeVirtualKey(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db
    .from('virtual_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Atomically increments spend on a virtual key, returning the new spend
 * or null if the cap would be exceeded (or the key is revoked).
 */
export async function tryConsumeBudget(
  db: SupabaseClient,
  virtualKeyId: string,
  costCents: number,
): Promise<number | null> {
  const { data, error } = await db.rpc('try_consume_budget', {
    p_virtual_key_id: virtualKeyId,
    p_cost_cents: costCents,
  });
  if (error) throw error;
  return (data as number | null) ?? null;
}

/* -----------------------------------------------------------------------------
 * oauth_authorizations
 * -------------------------------------------------------------------------- */

export async function createOAuthAuthorization(
  db: SupabaseClient,
  row: Omit<OAuthAuthorization, 'id' | 'created_at' | 'consumed_at'>,
): Promise<OAuthAuthorization> {
  const { data, error } = await db
    .from('oauth_authorizations')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as OAuthAuthorization;
}

export async function consumeOAuthAuthorization(
  db: SupabaseClient,
  code: string,
): Promise<OAuthAuthorization | null> {
  // Atomically mark consumed iff not yet consumed and not expired.
  const { data, error } = await db
    .from('oauth_authorizations')
    .update({ consumed_at: new Date().toISOString() })
    .eq('code', code)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as OAuthAuthorization | null;
}

/* -----------------------------------------------------------------------------
 * usage_events
 * -------------------------------------------------------------------------- */

export async function insertUsageEvent(
  db: SupabaseClient,
  row: Omit<UsageEvent, 'id' | 'ts'> & { ts?: string },
): Promise<void> {
  const { error } = await db.from('usage_events').insert(row);
  if (error) throw error;
}

export async function listRecentUsage(
  db: SupabaseClient,
  userId: string,
  limit = 100,
): Promise<UsageEvent[]> {
  const { data, error } = await db
    .from('usage_events')
    .select('*')
    .eq('user_id', userId)
    .order('ts', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as UsageEvent[];
}

/* -----------------------------------------------------------------------------
 * audit_log
 * -------------------------------------------------------------------------- */

export async function logAudit(
  db: SupabaseClient,
  row: {
    user_id?: string | null;
    action: string;
    metadata?: Record<string, unknown> | null;
    ip?: string | null;
    user_agent?: string | null;
  },
): Promise<void> {
  const { error } = await db.from('audit_log').insert(row);
  if (error) throw error;
}
