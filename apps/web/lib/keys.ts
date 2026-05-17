/**
 * Virtual key generation. Format:
 *   akw_live_<provider-initial>_<32-char-url-safe-random>
 * Example: akw_live_o_aBc...XyZ
 */

import { sha256Hex } from '@akw/crypto';
import type { Provider } from '@akw/db';

const PROVIDER_INITIAL: Record<Provider, string> = {
  openai: 'o',
  anthropic: 'a',
  google: 'g',
  deepgram: 'd',
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomString(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export interface NewVirtualKey {
  /** The full secret, shown to the user once and never stored. */
  full: string;
  /** Stable prefix (visible in dashboards). */
  prefix: string;
  /** SHA-256 of the full key, stored for lookup. */
  hash: string;
}

export async function generateVirtualKey(provider: Provider): Promise<NewVirtualKey> {
  const random = randomString(32);
  const full = `akw_live_${PROVIDER_INITIAL[provider]}_${random}`;
  const prefix = full.slice(0, 16); // 'akw_live_o_aBcD' (16 chars)
  const hash = await sha256Hex(full);
  return { full, prefix, hash };
}

/** Mint a vendor client_id + client_secret. */
export async function generateVendorCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
  clientSecretHash: string;
}> {
  const clientId = `akw_client_${randomString(24)}`;
  const clientSecret = `akw_secret_${randomString(48)}`;
  const clientSecretHash = await sha256Hex(clientSecret);
  return { clientId, clientSecret, clientSecretHash };
}

/** Generate an OAuth authorization code (single-use, short-lived). */
export function generateAuthorizationCode(): string {
  return `akw_code_${randomString(40)}`;
}
