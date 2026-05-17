/**
 * Workers-side vault: decrypt a user's root key given the virtual key's row.
 * Mirrors apps/web/lib/vault.ts but runs in the Workers runtime.
 */

import {
  loadMEK,
  unwrapDEK,
  decryptSecret,
  sealFromBase64,
  type SealedBytes,
} from '@akw/crypto';
import {
  createServiceClient,
  getUserDek,
  getRootKey,
} from '@akw/db';
import type { Env } from './env.js';

export interface DecryptedRootKey {
  plaintext: string;
  userId: string;
  rootKeyId: string;
}

export async function decryptRootKeyForVirtual(
  env: Env,
  rootKeyId: string,
): Promise<DecryptedRootKey | null> {
  const db = createServiceClient({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const root = await getRootKey(db, rootKeyId);
  if (!root) return null;

  const dekRow = await getUserDek(db, root.user_id);
  if (!dekRow) return null;

  const mek = loadMEK(env.MEK);
  const wrappedDek = sealFromBase64({
    ciphertext: dekRow.wrapped_dek,
    nonce: dekRow.dek_nonce,
  });
  const dek = await unwrapDEK(wrappedDek, mek);

  const sealed: SealedBytes = sealFromBase64({
    ciphertext: root.encrypted_key,
    nonce: root.key_nonce,
  });
  const plaintext = await decryptSecret(sealed, dek);
  return { plaintext, userId: root.user_id, rootKeyId: root.id };
}
