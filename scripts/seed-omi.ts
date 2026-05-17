/**
 * Seed the `omi.me` vendor app into the database. Prints client_id + client_secret
 * once — save them to omi.me's environment.
 *
 * Run AFTER your Supabase project is connected and .env is configured:
 *   cp .env.example .env && pnpm --filter @akw/scripts seed:omi
 */

import { sha256Hex } from '@akw/crypto';
import { createServiceClient } from '@akw/db';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing env: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomString(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

const clientId = `akw_client_${randomString(24)}`;
const clientSecret = `akw_secret_${randomString(48)}`;
const clientSecretHash = await sha256Hex(clientSecret);

const db = createServiceClient({ url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE });

const row = {
  owner_user_id: null,
  name: 'omi.me',
  slug: 'omi',
  client_id: clientId,
  client_secret_hash: clientSecretHash,
  redirect_uris: ['https://omi.me/auth/callback', 'http://localhost:3001/callback'],
  allowed_scopes: ['openai', 'anthropic', 'google', 'deepgram'],
  logo_url: null,
  homepage_url: 'https://omi.me',
  description: 'Personal AI wearable that captures your conversations.',
  approved_at: new Date().toISOString(),
};

const { data, error } = await db.from('vendor_apps').insert(row).select('*').single();
if (error) {
  console.error('Insert failed:', error);
  process.exit(1);
}

console.log('\n✓ omi.me vendor app seeded\n');
console.log('client_id:     ', clientId);
console.log('client_secret: ', clientSecret);
console.log('vendor_app_id: ', data.id);
console.log('\nGive these to omi.me. The client_secret will not be retrievable again.\n');
