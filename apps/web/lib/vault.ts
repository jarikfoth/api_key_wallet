/**
 * Server-side vault operations. All functions here:
 *   - Run on the server only (server actions, route handlers).
 *   - Take a userId you've already authenticated.
 *   - Encrypt/decrypt root keys via the user's DEK + the app MEK.
 *
 * Do NOT call from client components.
 */

import 'server-only';
import {
  loadMEK,
  unwrapDEK,
  encryptSecret,
  decryptSecret,
  sealToBase64,
  sealFromBase64,
  type SealedBytes,
} from '@akw/crypto';
import {
  getUserDek,
  getRootKeyByProvider,
  upsertRootKey,
  type Provider,
} from '@akw/db';
import { getServiceSupabase } from './supabase/server';
import { serverEnv } from './env';

async function getUserDekBytes(userId: string): Promise<Uint8Array> {
  const service = getServiceSupabase();
  const wrappedRow = await getUserDek(service, userId);
  if (!wrappedRow) {
    throw new Error(`No DEK provisioned for user ${userId}. Did the auth callback run?`);
  }
  const { mek: mekB64 } = serverEnv();
  const mek = loadMEK(mekB64);
  const wrapped = sealFromBase64({
    ciphertext: wrappedRow.wrapped_dek,
    nonce: wrappedRow.dek_nonce,
  });
  return unwrapDEK(wrapped, mek);
}

/** Encrypt a root API key and upsert it for (user, provider). */
export async function storeRootKey(
  userId: string,
  provider: Provider,
  plaintextKey: string,
  label?: string | null,
): Promise<void> {
  const dek = await getUserDekBytes(userId);
  const sealed = await encryptSecret(plaintextKey, dek);
  const b64 = sealToBase64(sealed);
  const service = getServiceSupabase();
  await upsertRootKey(service, {
    user_id: userId,
    provider,
    encrypted_key: b64.ciphertext,
    key_nonce: b64.nonce,
    label: label ?? null,
  });
}

/** Decrypt the root key for (user, provider). Server-only. */
export async function readRootKey(userId: string, provider: Provider): Promise<string | null> {
  const service = getServiceSupabase();
  const row = await getRootKeyByProvider(service, userId, provider);
  if (!row) return null;
  const dek = await getUserDekBytes(userId);
  const sealed: SealedBytes = sealFromBase64({
    ciphertext: row.encrypted_key,
    nonce: row.key_nonce,
  });
  return decryptSecret(sealed, dek);
}

/**
 * Decrypt a root key given its rowId — used by the Workers proxy where the
 * virtual key lookup gives us the root_key_id directly.
 */
export async function readRootKeyById(rootKeyId: string): Promise<string | null> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('root_keys')
    .select('*')
    .eq('id', rootKeyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const dek = await getUserDekBytes(data.user_id);
  const sealed: SealedBytes = sealFromBase64({
    ciphertext: data.encrypted_key,
    nonce: data.key_nonce,
  });
  return decryptSecret(sealed, dek);
}
